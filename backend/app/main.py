"""
AMY -- FastAPI Entry Point
Backend con RAG para ensenanza socratica de Bases de Datos.
"""

import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, Depends, status as http_status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import asyncio


from app.config import settings
from app.database.connection import db
from app.integrations.ollama_client import ollama_client
from app.core.brain import brain
from app.core.api_keys import api_keys
from app.core.rate_limit import limiter
from app.rag.embeddings import compute_missing_embeddings, generate_embedding
from app.rag.chunker import chunk_text
from app.rag.retriever import get_fragment_count
from app.models.schemas import (
    ChatRequest, ChatResponse, IngestRequest, IngestResponse, HealthResponse
)
from app.auth.router import router as auth_router
from app.auth.dependencies import get_current_admin_user, get_current_user
from app.chat.router import router as chat_router
from app.admin.router import router as admin_router
from app.speech.router import router as speech_router
from app.rag.dmz_validator import validate_document_dmz

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

# Rate limiting (slowapi + Redis): definido en app/core/rate_limit.py



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("AMY -- Iniciando servicios...")
    logger.info("=" * 60)

    await db.connect()

    # Garantizar que las tablas existen (idem-potente, no falla si ya existen)
    await db.init_tables()
    
    # Conectarse al caché de Redis
    from app.cache.redis_cache import redis_cache
    await redis_cache.connect()

    # Cargar las API keys renovadas desde el panel admin (y mantenerlas sincronizadas entre workers)
    await api_keys.start()

    try:

        ollama_ok = await ollama_client.is_healthy()
        if ollama_ok:
            import asyncio
            # Ejecutar la generación de embeddings en segundo plano para no bloquear el inicio del servidor
            asyncio.create_task(compute_missing_embeddings())
            logger.info("Generación de embeddings RAG iniciada en segundo plano")
        else:
            logger.warning("Ollama no disponible aun. Los embeddings se generaran despues.")
    except Exception as e:
        logger.warning("No se pudieron generar embeddings al inicio: %s", e)


    logger.info("Backend listo para recibir consultas")
    yield

    await api_keys.stop()
    await db.disconnect()
    
    # Desconectarse del caché de Redis
    await redis_cache.disconnect()
    
    await ollama_client.close()
    logger.info("Servicios desconectados")



app = FastAPI(
    title="AMY -- Fundamentos de Base de Datos UPEC",
    description="API de tutoria inteligente con RAG y Ollama/Mistral",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Configurar slowapi en la app ──────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


# ── Routers ──────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(speech_router)



# ── Helpers ──────────────────────────────────────────────────


async def _load_owned_history(conversation_id: str | None, user_id: str, limit: int) -> list[dict] | None:
    """
    Historial reciente de una conversación SOLO si pertenece al usuario.
    Una conversación ajena se ignora (antes se cargaba cualquier conversation_id
    y su contenido llegaba al modelo, permitiendo leer chats de otros).
    """
    if not conversation_id:
        return None
    owner = await db.fetchval("SELECT usuario_id FROM conversaciones WHERE id = $1", conversation_id)
    if owner is None:
        return None
    if str(owner) != user_id:
        logger.warning("Intento de leer historial ajeno: conv=%s user=%s", conversation_id, user_id)
        raise HTTPException(status_code=403, detail="No tienes acceso a esta conversacion.")
    rows = await db.fetch(
        """SELECT sender, content FROM mensajes
           WHERE conversacion_id = $1
           ORDER BY created_at ASC LIMIT $2""",
        conversation_id, limit,
    )
    return [{"role": "user" if r["sender"] == "user" else "assistant", "content": r["content"]} for r in rows] or None


async def _save_chat_messages(
    conversation_id: str,
    user_id: str,
    student_query: str,
    result: dict,
    attachment: dict | None = None,
    rag_learned: bool = False
):
    """Persiste el mensaje del estudiante y la respuesta del tutor en la BD."""
    now = datetime.now(timezone.utc)

    # Verificar si la conversacion existe y pertenece al usuario
    owner = await db.fetchval(
        "SELECT usuario_id FROM conversaciones WHERE id = $1", conversation_id
    )
    if owner is None:
        # Crear la conversación automáticamente si aún no estaba en BD
        first_words = student_query.strip()[:60] or (attachment.get("filename", "Nuevo archivo") if attachment else "Nueva conversación")
        try:
            await db.execute(
                """INSERT INTO conversaciones (id, usuario_id, titulo, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5)
                   ON CONFLICT (id) DO NOTHING""",
                conversation_id,
                user_id,
                first_words,
                now,
                now,
            )
        except Exception as e:
            logger.error("Error creando conversacion automatica: %s", e)
    elif str(owner) != user_id:
        logger.warning(
            "Intento de guardar mensaje en conversacion ajena: conv=%s user=%s owner=%s",
            conversation_id,
            user_id,
            owner,
        )
        return

    # Metadatos del adjunto
    attachment_json = None
    if attachment:
        attachment_json = json.dumps({
            "filename": attachment.get("filename"),
            "mime_type": attachment.get("mime_type"),
            "size_bytes": attachment.get("size_bytes", 0),
            "base64_data": attachment.get("base64_data") if (attachment.get("mime_type", "").startswith("image/") and len(attachment.get("base64_data", "")) < 300000) else None
        })

    # Mensaje del estudiante
    await db.execute(
        """INSERT INTO mensajes (id, conversacion_id, sender, content, topic, source, rag_used, attachment, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        str(uuid.uuid4()),
        conversation_id,
        "user",
        student_query,
        result.get("topic"),
        None,
        False,
        attachment_json,
        now,
    )

    # Respuesta del tutor (asegurar feedback limpio sin envoltorios JSON)
    live_example_json = None
    if result.get("live_example"):
        live_example_json = json.dumps(result["live_example"])

    feedback_clean = result.get("feedback", "")
    if isinstance(feedback_clean, str) and feedback_clean.strip().startswith("{"):
        try:
            parsed = json.loads(feedback_clean.strip())
            feedback_clean = (
                parsed.get("assistant", {}).get("message", {}).get("text")
                or parsed.get("message", {}).get("text")
                or parsed.get("feedback")
                or feedback_clean
            )
        except Exception:
            pass

    await db.execute(
        """INSERT INTO mensajes (id, conversacion_id, sender, content, topic, source, rag_used, live_example, rag_learned, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
        str(uuid.uuid4()),
        conversation_id,
        "tutor",
        feedback_clean,
        result.get("topic"),
        result.get("source"),
        result.get("rag_context_used", False),
        live_example_json,
        rag_learned,
        now,
    )

    # Actualizar timestamp de la conversacion
    await db.execute(
        "UPDATE conversaciones SET updated_at = $1 WHERE id = $2",
        now,
        conversation_id,
    )


# ── Endpoints ────────────────────────────────────────────────


@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat_endpoint(
    request_body: ChatRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if not request_body.student_query.strip() and not request_body.attachment:
        raise HTTPException(status_code=400, detail="La consulta o el adjunto no pueden estar vacíos.")
    user_id = current_user["id"]
    try:
        # Últimos 10 mensajes, solo si la conversación es del usuario
        chat_history = await _load_owned_history(request_body.conversation_id, user_id, 10)

        attachment_dict = request_body.attachment.model_dump() if request_body.attachment else None

        # Evaluación pedagógica del adjunto (solo un admin puede añadirlo a la base de conocimiento)
        is_learned, learn_reason = False, None
        if attachment_dict:
            from app.rag.knowledge_evaluator import evaluate_and_index_attachment
            is_learned, learn_reason, _ = await evaluate_and_index_attachment(
                filename=attachment_dict["filename"],
                mime_type=attachment_dict["mime_type"],
                base64_data=attachment_dict["base64_data"],
                student_query=request_body.student_query,
                allow_indexing=current_user.get("rol") == "admin",
            )

        query_text = request_body.student_query.strip() or f"Analiza el archivo adjunto: {attachment_dict.get('filename') if attachment_dict else ''}"
        result = await brain.think(
            query_text,
            chat_history=chat_history,
            model_preference=request_body.model_preference
        )
        if result.get("source") == "error":
            raise HTTPException(status_code=503, detail=result)

        result["rag_learned"] = is_learned
        result["rag_learned_reason"] = learn_reason

        # Persistir mensajes en la conversación del usuario
        if request_body.conversation_id:
            try:
                await _save_chat_messages(
                    request_body.conversation_id,
                    user_id,
                    request_body.student_query,
                    result,
                    attachment=attachment_dict,
                    rag_learned=is_learned
                )
            except Exception as e:
                logger.error("Error al persistir mensajes del chat: %s", e)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error en /api/chat: %s", e)
        raise HTTPException(status_code=500, detail="Error interno del tutor.")


@app.post("/api/chat/stream")
@limiter.limit("30/minute")
async def chat_stream_endpoint(
    request_body: ChatRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Endpoint SSE: emite tokens del LLM en tiempo real.
    El cliente recibe 'data: <token>\n\n' mientras Gemini genera la respuesta.
    Fallback automatico a respuesta completa si el proveedor no soporta stream.
    """
    if not request_body.student_query.strip() and not request_body.attachment:
        raise HTTPException(status_code=400, detail="La consulta o el adjunto no pueden estar vacíos.")

    user_id = current_user["id"]
    attachment_dict = request_body.attachment.model_dump() if request_body.attachment else None
    # Se valida antes de abrir el stream para que una conversación ajena responda 403
    chat_history = await _load_owned_history(request_body.conversation_id, user_id, 8)

    async def generate_sse():
        try:
            # Evaluación pedagógica del adjunto en segundo plano (solo un admin puede indexarlo)
            learn_task = None
            if attachment_dict:
                from app.rag.knowledge_evaluator import evaluate_and_index_attachment
                learn_task = asyncio.create_task(
                    evaluate_and_index_attachment(
                        filename=attachment_dict["filename"],
                        mime_type=attachment_dict["mime_type"],
                        base64_data=attachment_dict["base64_data"],
                        student_query=request_body.student_query,
                        allow_indexing=current_user.get("rol") == "admin",
                    )
                )

            # Verificar cache solo si no hay adjunto
            if not attachment_dict:
                from app.cache.redis_cache import redis_cache
                from app.core.guardrails import SYSTEM_PROMPT
                history_context = str([m["content"] for m in chat_history]) if chat_history else ""
                cached = await redis_cache.get_cached_response(request_body.student_query, context=history_context)
                if cached:
                    if request_body.conversation_id:
                        try:
                            await _save_chat_messages(
                                request_body.conversation_id,
                                user_id,
                                request_body.student_query,
                                cached,
                            )
                        except Exception as e:
                            logger.error("Error al guardar mensaje en cache stream: %s", e)
                    yield f"data: {json.dumps({'type': 'result', 'data': cached})}\n\n"
                    return

            # Intentar Gemini streaming si esta disponible
            from app.integrations.gemini_client import gemini_client
            from app.core.prompts import build_rag_prompt
            from app.rag.retriever import semantic_search
            from app.core.guardrails import sanitize_rag_context
            from datetime import datetime, timezone, timedelta

            query_text = request_body.student_query.strip() or f"Analiza el archivo adjunto: {attachment_dict.get('filename') if attachment_dict else ''}"
            context_fragments = await semantic_search(query_text)
            if context_fragments:
                context_fragments = sanitize_rag_context(context_fragments)

            enriched_prompt = build_rag_prompt(
                query_text, context_fragments, chat_history=chat_history
            )
            ecuador = timezone(timedelta(hours=-5))
            fecha_actual = datetime.now(ecuador).strftime('%A %d de %B del %Y, %H:%M')
            system_ctx = SYSTEM_PROMPT + f' La fecha y hora actual en Ecuador es: {fecha_actual}.'

            if api_keys.get("gemini"):
                full_text = ""
                try:
                    async for token in gemini_client.stream(enriched_prompt, system_ctx, attachment=attachment_dict):
                        full_text += token
                        yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
                    
                    # Obtener resultado de la evaluación pedagógica si hubo adjunto
                    is_learned, learn_reason = False, None
                    if learn_task:
                        try:
                            is_learned, learn_reason, _ = await learn_task
                        except Exception as l_err:
                            logger.error("Error esperando learn_task: %s", l_err)
                            
                    # Enviar resultado final (metadata)
                    from app.core.guardrails import validate_response
                    result = validate_response(
                        full_text,
                        student_query=request_body.student_query,
                        attachment=attachment_dict
                    )
                    result["source"] = "gemini"
                    result["rag_context_used"] = len(context_fragments) > 0
                    result["rag_sources"] = []
                    result["rag_learned"] = is_learned
                    result["rag_learned_reason"] = learn_reason

                    # Persistir mensaje en la base de datos si hay conversación
                    if request_body.conversation_id:
                        try:
                            await _save_chat_messages(
                                request_body.conversation_id,
                                user_id,
                                request_body.student_query,
                                result,
                                attachment=attachment_dict,
                                rag_learned=is_learned
                            )
                        except Exception as e:
                            logger.error("Error al guardar mensaje en stream: %s", e)

                    yield f"data: {json.dumps({'type': 'done', 'data': result})}\n\n"
                    return

                except Exception as e:
                    logger.warning("Gemini stream fallo, cayendo a brain.think: %s", e)

            # Fallback: usar brain.think() normal y enviar resultado completo
            result = await brain.think(
                query_text,
                chat_history=chat_history,
                model_preference=request_body.model_preference
            )

            is_learned, learn_reason = False, None
            if learn_task:
                try:
                    is_learned, learn_reason, _ = await learn_task
                except Exception:
                    pass
            result["rag_learned"] = is_learned
            result["rag_learned_reason"] = learn_reason

            # Persistir mensaje en la base de datos si hay conversación
            if request_body.conversation_id:
                try:
                    await _save_chat_messages(
                        request_body.conversation_id,
                        user_id,
                        request_body.student_query,
                        result,
                        attachment=attachment_dict,
                        rag_learned=is_learned
                    )
                except Exception as e:
                    logger.error("Error al guardar mensaje en fallback stream: %s", e)

            yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"

        except Exception as e:
            # El detalle queda en el log del servidor; al navegador solo un mensaje genérico
            logger.error("Error en SSE stream: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': 'El tutor no pudo responder en este momento. Inténtalo de nuevo.'})}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )



@app.post("/api/rag/ingest", response_model=IngestResponse)
@limiter.limit("10/minute")
async def ingest_document(
    body: IngestRequest,
    request: Request,
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Pasa todo documento entrante por la Zona Militarizada de Ingesta (DMZ).
    Si el documento no trata sobre Fundamentos o Administración de BD, es rechazado.
    """
    try:
        # 1. Pasar por la Zona Militarizada de Ingesta RAG
        dmz_result = await validate_document_dmz(body.contenido, body.categoria)
        if not dmz_result["is_valid"]:
            logger.warning("Ingesta RECHAZADA por la Zona Militarizada: %s", dmz_result["reason"])
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=dmz_result["reason"]
            )

        # Usar la categoría sugerida por el guardrail si aplica
        assigned_category = dmz_result.get("category") or body.categoria

        # 2. Fragmentar el contenido aprobado
        chunks = chunk_text(body.contenido, chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
        if not chunks:
            raise HTTPException(status_code=400, detail="El documento no genero fragmentos validos.")

        created = 0
        for chunk in chunks:
            embedding = await generate_embedding(chunk)
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
            metadata_json = json.dumps(body.metadata)
            await db.execute(
                """INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata, embedding)
                   VALUES ($1, $2, $3::jsonb, $4::vector)""",
                assigned_category, chunk, metadata_json, embedding_str
            )
            created += 1

        # Invalidar caché de respuestas del chat al ingestar nuevo conocimiento en el RAG
        from app.cache.redis_cache import redis_cache
        await redis_cache.invalidate_responses()

        logger.info("Admin %s ingesto documento aprobado (%d fragmentos)", current_admin["email"], created)
        return IngestResponse(fragments_created=created, message=f"Documento APROBADO por la DMZ: {created} fragmentos creados.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error en ingesta: %s", e)
        raise HTTPException(status_code=500, detail="Error al ingestar el documento. Revisa el registro del servidor.")



@app.get("/health", response_model=HealthResponse)
async def health_check():
    db_ok = await db.is_healthy()
    from app.cache.redis_cache import redis_cache
    redis_ok = await redis_cache.is_healthy()

    ollama_status = await ollama_client.get_status()

    gemini_active = bool(api_keys.get("gemini"))
    groq_active = bool(api_keys.get("groq"))

    fragments = await get_fragment_count()
    is_ai_ready = gemini_active or groq_active or (ollama_status == "connected")

    return HealthResponse(
        status="ok" if (db_ok and is_ai_ready and redis_ok) else "degraded",
        database="connected" if db_ok else "disconnected",
        ollama=ollama_status,
        redis="connected" if redis_ok else "disconnected",
        gemini="connected" if gemini_active else "disconnected",
        groq="connected" if groq_active else "disconnected",
        model=settings.OLLAMA_MODEL,
        fragments_count=fragments
    )



@app.post("/api/rag/generate-embeddings")
@limiter.limit("5/minute")
async def generate_embeddings_endpoint(
    request: Request,
    current_admin: dict = Depends(get_current_admin_user)
):
    try:
        processed = await compute_missing_embeddings()
        logger.info("Admin %s ejecuto generacion de embeddings (%d procesados)", current_admin.get("email"), processed)
        return {"processed": processed, "message": f"{processed} embeddings generados."}
    except Exception as e:
        logger.error("Error generando embeddings: %s", e)
        raise HTTPException(status_code=500, detail="Error al generar los embeddings. Revisa el registro del servidor.")
