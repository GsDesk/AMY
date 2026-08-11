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
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database.connection import db
from app.integrations.ollama_client import ollama_client
from app.core.brain import brain
from app.rag.embeddings import compute_missing_embeddings, generate_embedding
from app.rag.chunker import chunk_text
from app.rag.retriever import get_fragment_count
from app.models.schemas import (
    ChatRequest, ChatResponse, IngestRequest, IngestResponse, HealthResponse
)
from app.auth.router import router as auth_router
from app.auth.security import decode_token
from app.auth.dependencies import get_current_admin_user
from app.chat.router import router as chat_router
from app.admin.router import router as admin_router
from app.rag.dmz_validator import validate_document_dmz

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Rate Limiting con slowapi + Redis ────────────────────────────────
# Usa Redis como backend para funcionar correctamente con múltiples workers Gunicorn.
_redis_url = getattr(settings, "REDIS_URL", "redis://redis:6379/0")
limiter = Limiter(key_func=get_remote_address, storage_uri=_redis_url)

_optional_bearer = HTTPBearer(auto_error=False)


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

    await db.disconnect()
    
    # Desconectarse del caché de Redis
    await redis_cache.disconnect()
    
    await ollama_client.close()
    logger.info("Servicios desconectados")



app = FastAPI(
    title="AMY -- Fundamentos de Base de Datos UPEC",
    description="API de tutoria inteligente con RAG y Ollama/Mistral",
    version="1.0.0",
    lifespan=lifespan
)

# ── Configurar slowapi en la app ──────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(chat_router)



# ── Helpers ──────────────────────────────────────────────────


async def _get_optional_user_id(request: Request) -> str | None:
    """Intenta extraer el user id del token Bearer si existe. No falla si no hay token."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:]
    try:
        payload = decode_token(token)
        return payload.get("sub")
    except Exception:
        return None


async def _save_chat_messages(
    conversation_id: str,
    user_id: str,
    student_query: str,
    result: dict,
) -> None:
    """Persiste el mensaje del estudiante y la respuesta del tutor en la BD."""
    now = datetime.now(timezone.utc)

    # Verificar que la conversacion pertenece al usuario
    owner = await db.fetchval(
        "SELECT usuario_id FROM conversaciones WHERE id = $1", conversation_id
    )
    if owner is None or str(owner) != user_id:
        logger.warning(
            "Intento de guardar mensaje en conversacion ajena: conv=%s user=%s",
            conversation_id,
            user_id,
        )
        return

    # Mensaje del estudiante
    await db.execute(
        """INSERT INTO mensajes (id, conversacion_id, sender, content, topic, source, rag_used, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        str(uuid.uuid4()),
        conversation_id,
        "user",
        student_query,
        result.get("topic"),
        None,
        False,
        now,
    )

    # Respuesta del tutor
    live_example_json = None
    if result.get("live_example"):
        live_example_json = json.dumps(result["live_example"])

    await db.execute(
        """INSERT INTO mensajes (id, conversacion_id, sender, content, topic, source, rag_used, live_example, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        str(uuid.uuid4()),
        conversation_id,
        "tutor",
        result.get("feedback", ""),
        result.get("topic"),
        result.get("source"),
        result.get("rag_context_used", False),
        live_example_json,
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
async def chat_endpoint(request_body: ChatRequest, request: Request):
    if not request_body.student_query.strip():
        raise HTTPException(status_code=400, detail="La consulta no puede estar vacia.")
    try:
        chat_history = None
        
        # Obtener historial de la conversación si existe
        if request_body.conversation_id:
            user_id = await _get_optional_user_id(request)
            if user_id:
                # Recuperar los últimos 10 mensajes de esta conversación para dar contexto
                rows = await db.fetch(
                    """SELECT sender, content 
                       FROM mensajes 
                       WHERE conversacion_id = $1 
                       ORDER BY created_at ASC 
                       LIMIT 10""",
                    request_body.conversation_id
                )
                if rows:
                    chat_history = []
                    for r in rows:
                        role = "user" if r["sender"] == "user" else "assistant"
                        chat_history.append({"role": role, "content": r["content"]})

        result = await brain.think(request_body.student_query, chat_history=chat_history)
        if result.get("source") == "error":
            raise HTTPException(status_code=503, detail=result)

        # Persistir mensajes si hay conversation_id y usuario autenticado
        if request_body.conversation_id:
            user_id = await _get_optional_user_id(request)
            if user_id:
                try:
                    await _save_chat_messages(
                        request_body.conversation_id,
                        user_id,
                        request_body.student_query,
                        result,
                    )
                except Exception as e:
                    logger.error("Error al persistir mensajes del chat: %s", e)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error en /api/chat: %s", e)
        raise HTTPException(status_code=500, detail="Error interno del tutor.")


@app.post("/api/rag/ingest", response_model=IngestResponse)
@limiter.limit("10/minute")
async def ingest_document(
    request: IngestRequest,
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Pasa todo documento entrante por la Zona Militarizada de Ingesta (DMZ).
    Si el documento no trata sobre Fundamentos o Administración de BD, es rechazado.
    """
    try:
        # 1. Pasar por la Zona Militarizada de Ingesta RAG
        dmz_result = await validate_document_dmz(request.contenido, request.categoria)
        if not dmz_result["is_valid"]:
            logger.warning("Ingesta RECHAZADA por la Zona Militarizada: %s", dmz_result["reason"])
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=dmz_result["reason"]
            )

        # Usar la categoría sugerida por el guardrail si aplica
        assigned_category = dmz_result.get("category") or request.categoria

        # 2. Fragmentar el contenido aprobado
        chunks = chunk_text(request.contenido, chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
        if not chunks:
            raise HTTPException(status_code=400, detail="El documento no genero fragmentos validos.")

        created = 0
        for chunk in chunks:
            embedding = await generate_embedding(chunk)
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
            metadata_json = json.dumps(request.metadata)
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
        raise HTTPException(status_code=500, detail=f"Error al ingestar documento: {str(e)}")



@app.get("/health", response_model=HealthResponse)
async def health_check():
    db_ok = await db.is_healthy()
    ollama_ok = await ollama_client.is_healthy()
    from app.cache.redis_cache import redis_cache
    redis_ok = await redis_cache.is_healthy()
    
    fragments = await get_fragment_count()
    
    return HealthResponse(
        status="ok" if (db_ok and ollama_ok and redis_ok) else "degraded",
        database="connected" if db_ok else "disconnected",
        ollama="connected" if ollama_ok else "disconnected",
        redis="connected" if redis_ok else "disconnected",
        model=settings.OLLAMA_MODEL,
        fragments_count=fragments
    )



@app.post("/api/rag/generate-embeddings")
async def generate_embeddings_endpoint():
    try:
        processed = await compute_missing_embeddings()
        return {"processed": processed, "message": f"{processed} embeddings generados."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
