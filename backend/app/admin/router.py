"""
AMY — Router de Administración & Gestión del RAG (DMZ Strict Mode)
Endpoints restringidos a usuarios con rol 'admin'.
"""

import asyncio
import io
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_admin_user
from app.database.connection import db
from app.config import settings
from app.core.api_keys import api_keys, PROVIDERS
from app.integrations.ollama_client import ollama_client
from app.integrations.groq_client import groq_client
from app.integrations.gemini_client import gemini_client
from app.cache.redis_cache import redis_cache
from app.rag.retriever import get_fragment_count
from app.rag.dmz_validator import review_document, split_pages
from app.rag.chunker import chunk_text
from app.rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

LOCAL_TZ = "America/Guayaquil"
SPANISH_MONTHS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

# rango -> (intervalo total, unidad de agrupación, número de cubetas)
TIME_RANGES = {
    "24h": (timedelta(hours=24), "hour", 24),
    "7days": (timedelta(days=7), "day", 7),
    "30days": (timedelta(days=30), "day", 30),
}


class UpdateRoleRequest(BaseModel):
    rol: str


class UpdateApiKeyRequest(BaseModel):
    apiKey: str


async def compute_activity_chart(category: str, time_range: str) -> dict:
    """Consultas de estudiantes por hora/día (no acumuladas), en hora local de Ecuador."""
    _, unit, buckets = TIME_RANGES.get(time_range, TIME_RANGES["30days"])
    rows = await db.fetch(
        f"""
        WITH cubetas AS (
            SELECT generate_series(
                date_trunc('{unit}', NOW() AT TIME ZONE '{LOCAL_TZ}') - ($1::int - 1) * INTERVAL '1 {unit}',
                date_trunc('{unit}', NOW() AT TIME ZONE '{LOCAL_TZ}'),
                INTERVAL '1 {unit}'
            ) AS inicio
        )
        SELECT c.inicio, COUNT(m.id) AS total
        FROM cubetas c
        LEFT JOIN mensajes m
               ON m.sender = 'user'
              AND (m.created_at AT TIME ZONE '{LOCAL_TZ}') >= c.inicio
              AND (m.created_at AT TIME ZONE '{LOCAL_TZ}') <  c.inicio + INTERVAL '1 {unit}'
              AND ($2 = 'all' OR m.topic = $2)
        GROUP BY c.inicio
        ORDER BY c.inicio
        """,
        buckets, category or "all",
    )
    labels = [
        f"{r['inicio'].hour:02d}:00" if unit == "hour" else f"{r['inicio'].day} {SPANISH_MONTHS[r['inicio'].month]}"
        for r in rows
    ]
    return {"labels": labels, "counts": [r["total"] for r in rows], "unit": unit}


@router.get("/stats")
async def get_admin_stats(
    category: str = Query(default="all"),
    time_range: str = Query(default="30days"),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Métricas reales del sistema calculadas en cada petición (el panel las consulta en vivo)."""
    span, _, _ = TIME_RANGES.get(time_range, TIME_RANGES["30days"])
    cat = category or "all"

    m = await db.fetchrow(
        f"""
        SELECT
            (SELECT COUNT(*) FROM usuarios) AS usuarios,
            (SELECT COUNT(*) FROM usuarios WHERE created_at >= NOW() - $1::interval) AS usuarios_nuevos,
            (SELECT COUNT(*) FROM conversaciones) AS conversaciones,
            (SELECT COUNT(*) FROM conversaciones WHERE created_at >= NOW() - $1::interval) AS conversaciones_periodo,
            (SELECT COUNT(DISTINCT c.usuario_id) FROM mensajes x JOIN conversaciones c ON c.id = x.conversacion_id
              WHERE x.sender = 'user' AND x.created_at >= NOW() - $1::interval) AS usuarios_activos,
            (SELECT COUNT(*) FROM mensajes WHERE sender = 'user' AND ($2 = 'all' OR topic = $2)) AS consultas,
            (SELECT COUNT(*) FROM mensajes WHERE sender = 'user' AND ($2 = 'all' OR topic = $2)
               AND created_at >= NOW() - $1::interval) AS consultas_periodo,
            (SELECT COUNT(*) FROM mensajes WHERE sender = 'user' AND ($2 = 'all' OR topic = $2)
               AND created_at >= NOW() - 2 * $1::interval AND created_at < NOW() - $1::interval) AS consultas_periodo_anterior,
            (SELECT COUNT(*) FROM mensajes WHERE sender = 'user' AND ($2 = 'all' OR topic = $2)
               AND (created_at AT TIME ZONE '{LOCAL_TZ}')::date = (NOW() AT TIME ZONE '{LOCAL_TZ}')::date) AS consultas_hoy,
            (SELECT COUNT(*) FROM mensajes WHERE sender = 'tutor' AND ($2 = 'all' OR topic = $2)
               AND created_at >= NOW() - $1::interval) AS respuestas_periodo,
            (SELECT COUNT(*) FROM mensajes WHERE sender = 'tutor' AND rag_used AND ($2 = 'all' OR topic = $2)
               AND created_at >= NOW() - $1::interval) AS respuestas_rag_periodo,
            (SELECT COUNT(*) FROM fragmentos_conocimiento WHERE ($2 = 'all' OR categoria = $2)) AS fragmentos,
            (SELECT COUNT(*) FROM fragmentos_conocimiento WHERE ($2 = 'all' OR categoria = $2)
               AND created_at >= NOW() - $1::interval) AS fragmentos_nuevos
        """,
        span, cat,
    )

    top_topics = await db.fetch(
        """SELECT COALESCE(topic, 'Sin tema') AS tema, COUNT(*) AS total
           FROM mensajes
           WHERE sender = 'user' AND created_at >= NOW() - $1::interval AND ($2 = 'all' OR topic = $2)
           GROUP BY 1 ORDER BY total DESC LIMIT 6""",
        span, cat,
    )

    # Solo agregados anónimos: el panel no expone quién preguntó ni el contenido de las consultas
    hourly_rows = await db.fetch(
        f"""SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE '{LOCAL_TZ}')::int AS hora, COUNT(*) AS total
            FROM mensajes
            WHERE sender = 'user' AND created_at >= NOW() - $1::interval AND ($2 = 'all' OR topic = $2)
            GROUP BY 1""",
        span, cat,
    )
    hourly = [0] * 24
    for r in hourly_rows:
        hourly[r["hora"]] = r["total"]

    engine_rows = await db.fetch(
        """SELECT COALESCE(source, 'desconocido') AS motor, COUNT(*) AS total
           FROM mensajes
           WHERE sender = 'tutor' AND created_at >= NOW() - $1::interval AND ($2 = 'all' OR topic = $2)
           GROUP BY 1 ORDER BY total DESC""",
        span, cat,
    )

    chart_data = await compute_activity_chart(cat, time_range)

    db_ok = await db.is_healthy()
    ollama_ok = await ollama_client.is_healthy()
    redis_ok = await redis_cache.is_healthy()

    respuestas = m["respuestas_periodo"]
    rag_rate = round(m["respuestas_rag_periodo"] / respuestas * 100, 1) if respuestas else 0.0
    anterior = m["consultas_periodo_anterior"]
    tendencia = round((m["consultas_periodo"] - anterior) / anterior * 100, 1) if anterior else None

    return {
        "usersCount": m["usuarios"],
        "newUsers": m["usuarios_nuevos"],
        "activeUsers": m["usuarios_activos"],
        "conversationsCount": m["conversaciones"],
        "conversationsInRange": m["conversaciones_periodo"],
        "queriesCount": m["consultas"],
        "queriesInRange": m["consultas_periodo"],
        "queriesToday": m["consultas_hoy"],
        "queriesTrend": tendencia,
        "repliesInRange": respuestas,
        "ragUsedCount": m["respuestas_rag_periodo"],
        "ragUsageRate": rag_rate,
        "fragmentsCount": m["fragmentos"],
        "newFragments": m["fragmentos_nuevos"],
        "topTopics": [{"topic": r["tema"], "count": r["total"]} for r in top_topics],
        "hourlyUsage": hourly,
        "engines": [{"source": r["motor"], "count": r["total"]} for r in engine_rows],
        "chart": chart_data,
        "health": {
            "database": "connected" if db_ok else "disconnected",
            "ollama": "connected" if ollama_ok else "disconnected",
            "redis": "connected" if redis_ok else "disconnected",
            "gemini": "configured" if api_keys.get("gemini") else "missing",
            "groq": "configured" if api_keys.get("groq") else "missing",
        },
        "serverTime": datetime.now(timezone.utc).isoformat(),
    }


# ── API Keys de proveedores de IA ────────────────────────────

def _key_client(provider: str):
    if provider == "groq":
        return groq_client
    if provider == "gemini":
        return gemini_client
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no soportado.")


@router.get("/api-keys")
async def list_api_keys(current_admin: dict = Depends(get_current_admin_user)):
    """Estado de las API keys (nunca se devuelve la clave completa)."""
    return [api_keys.describe(p) for p in PROVIDERS]


@router.put("/api-keys/{provider}")
async def update_api_key(
    provider: str,
    body: UpdateApiKeyRequest,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Valida la nueva clave contra el proveedor y, si es válida, la guarda cifrada."""
    client = _key_client(provider)
    key = body.apiKey.strip()
    if len(key) < 20 or any(ch.isspace() for ch in key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El formato de la clave no es válido.")

    valid, message = await client.validate_key(key)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    await api_keys.save(provider, key, current_admin["email"])
    logger.info("Admin %s renovó la API key de %s", current_admin["email"], provider)
    return {"message": f"Clave de {PROVIDERS[provider]['label']} actualizada. {message}", "key": api_keys.describe(provider)}


@router.post("/api-keys/{provider}/test")
async def test_api_key(provider: str, current_admin: dict = Depends(get_current_admin_user)):
    """Comprueba en vivo la clave activa del proveedor."""
    client = _key_client(provider)
    key = api_keys.get(provider)
    if not key:
        return {"valid": False, "message": "No hay ninguna clave configurada para este proveedor."}
    valid, message = await client.validate_key(key)
    return {"valid": valid, "message": message}


@router.delete("/api-keys/{provider}")
async def reset_api_key(provider: str, current_admin: dict = Depends(get_current_admin_user)):
    """Elimina la clave guardada desde el panel y vuelve a usar la del archivo .env."""
    _key_client(provider)
    await api_keys.clear(provider)
    logger.info("Admin %s restableció la API key de %s al valor del .env", current_admin["email"], provider)
    return {"message": "Se eliminó la clave del panel; se usa de nuevo la del archivo .env.", "key": api_keys.describe(provider)}



@router.get("/analytics")
async def get_admin_analytics(current_admin: dict = Depends(get_current_admin_user)):
    """Calcula métricas verídicas de la base de datos de conocimiento RAG."""
    total_fragments = await get_fragment_count()

    rows = await db.fetch("""
        SELECT categoria, COUNT(*) as cantidad
        FROM fragmentos_conocimiento
        GROUP BY categoria
        ORDER BY cantidad DESC
    """)

    distribution = []
    for r in rows:
        cant = r["cantidad"]
        pct = round((cant / total_fragments * 100), 1) if total_fragments > 0 else 0.0
        distribution.append({
            "categoria": r["categoria"],
            "cantidad": cant,
            "porcentaje": pct
        })

    return {
        "totalFragments": total_fragments,
        "vectorDimension": "768-D",
        "embedModel": "nomic-embed-text",
        "indexType": "HNSW",
        "distanceMetric": "Cosine (1 - cos)",
        "similarityThreshold": settings.SIMILARITY_THRESHOLD,
        "distribution": distribution
    }


@router.get("/dmz-logs")
async def get_dmz_logs(current_admin: dict = Depends(get_current_admin_user)):
    """Retorna los registros verídicos de auditoría de ingesta en la Zona Militarizada."""
    await db.execute("""
        CREATE TABLE IF NOT EXISTS auditoria_dmz (
            id VARCHAR(100) PRIMARY KEY,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            evento VARCHAR(250) NOT NULL,
            categoria VARCHAR(100) NOT NULL,
            estado VARCHAR(50) NOT NULL CHECK (estado IN ('APROBADO', 'RECHAZADO')),
            motivo TEXT
        );
    """)

    rows = await db.fetch("""
        SELECT id, timestamp, evento, categoria, estado, motivo
        FROM auditoria_dmz
        ORDER BY timestamp DESC
        LIMIT 50
    """)

    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"].isoformat() if r["timestamp"] else None,
            "evento": r["evento"],
            "categoria": r["categoria"],
            "estado": r["estado"],
            "motivo": r["motivo"]
        }
        for r in rows
    ]


@router.get("/users")
async def list_users(current_admin: dict = Depends(get_current_admin_user)):
    """Retorna el listado real de todos los usuarios registrados."""
    rows = await db.fetch(
        "SELECT id, email, nombre, rol, created_at FROM usuarios ORDER BY created_at DESC"
    )
    return [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "nombre": r["nombre"],
            "rol": r.get("rol", "estudiante"),
            "createdAt": r["created_at"].isoformat() if r["created_at"] else None
        }
        for r in rows
    ]


@router.post("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    body: UpdateRoleRequest,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Permite cambiar el rol de un usuario ('estudiante' o 'admin')."""
    if body.rol not in ("estudiante", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol inválido. Debe ser 'estudiante' o 'admin'."
        )

    if user_id == current_admin["id"] and body.rol != "admin":
        admin_count = await db.fetchval("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'") or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes despromover al único administrador del sistema."
            )

    await db.execute(
        "UPDATE usuarios SET rol = $1 WHERE id = $2",
        body.rol, user_id
    )
    logger.info("Admin %s cambió el rol del usuario %s a %s", current_admin["email"], user_id, body.rol)
    return {"message": f"Rol actualizado a '{body.rol}' con éxito."}


INGEST_JOB_TTL = 6 * 3600          # el progreso de una indexación se conserva 6 horas
MAX_FRAGMENTS_PER_DOCUMENT = 1500  # límite de seguridad para libros muy extensos
_ingest_tasks: set = set()         # referencias a las tareas en segundo plano (evita que el GC las corte)


def _extract_pages(filename: str, ext: str, file_bytes: bytes) -> list[str]:
    """Texto del archivo separado por páginas (reales en PDF, de ~3000 caracteres en el resto)."""
    if ext == "pdf":
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        return [(page.extract_text() or "") for page in reader.pages]
    if ext in ("docx", "doc"):
        import docx
        document = docx.Document(io.BytesIO(file_bytes))
        return split_pages("\n".join(p.text for p in document.paragraphs if p.text))
    return split_pages(file_bytes.decode("utf-8", errors="ignore"))


async def _set_job(job_id: str, **fields):
    if redis_cache.redis is None:
        return
    key = f"ingest_job:{job_id}"
    await redis_cache.redis.hset(key, mapping={k: str(v) for k, v in fields.items()})
    await redis_cache.redis.expire(key, INGEST_JOB_TTL)


async def _index_document(job_id: str, text: str, categoria: str, metadata: dict, admin_email: str):
    """Fragmenta el documento aprobado y genera los embeddings, publicando el progreso en Redis."""
    try:
        chunks = chunk_text(text, chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
        chunks = [c for c in chunks if len(c.strip()) >= 80][:MAX_FRAGMENTS_PER_DOCUMENT]
        await _set_job(job_id, status="indexing", total=len(chunks), done=0)
        meta_json = json.dumps(metadata)
        pending_embeddings = 0

        for i, chunk in enumerate(chunks, 1):
            try:
                embedding = await generate_embedding(chunk)
            except Exception as e:
                logger.warning("Embedding no generado para un fragmento de %s: %s", metadata.get("fuente"), e)
                embedding = None
            if embedding:
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                await db.execute(
                    """INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata, embedding)
                       VALUES ($1, $2, $3::jsonb, $4::vector)""",
                    categoria, chunk, meta_json, embedding_str,
                )
            else:
                # Sin vector de ceros: se guarda sin embedding y se completa más tarde
                pending_embeddings += 1
                await db.execute(
                    """INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata)
                       VALUES ($1, $2, $3::jsonb)""",
                    categoria, chunk, meta_json,
                )
            if i % 3 == 0 or i == len(chunks):
                await _set_job(job_id, done=i)

        await redis_cache.invalidate_responses()
        await _set_job(job_id, status="done", done=len(chunks), fragments=len(chunks), pending=pending_embeddings)
        logger.info("Admin %s indexó %s (%d fragmentos)", admin_email, metadata.get("fuente"), len(chunks))
    except Exception as e:
        logger.error("Error indexando documento %s: %s", metadata.get("fuente"), e)
        await _set_job(job_id, status="error", error="No se pudo completar la indexación del documento.")


@router.post("/ingest-file")
async def ingest_academic_file(
    file: UploadFile = File(...),
    categoria: str = Form(...),
    fuente: Optional[str] = Form(None),
    autor: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    1. Extrae el texto por páginas.
    2. Revisión de contenido: la IA lee al menos las 2 primeras páginas con contenido y otras
       repartidas por el documento; si no trata de bases de datos, se rechaza.
    3. Si se aprueba, la indexación (fragmentos + embeddings) continúa en segundo plano y su
       progreso se consulta en /ingest-jobs/{job_id}.
    """
    filename = file.filename or "documento"
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext not in ("txt", "pdf", "docx", "doc"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Formato no soportado. Debe ser un archivo .txt, .pdf, .docx o .doc.")

    file_bytes = await file.read()
    try:
        pages = _extract_pages(filename, ext, file_bytes)
    except Exception as err:
        logger.error("Error al extraer texto del archivo %s: %s", filename, err)
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"No se pudo leer el archivo '{filename}'. Asegúrate de que no esté dañado o protegido.")

    full_text = "\n".join(pages).strip()
    if not full_text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "El archivo no contiene texto legible (puede ser un PDF escaneado como imagen).")

    review = await review_document(pages, categoria=categoria)
    report = review.get("report", {})
    evento = f"Ingesta de archivo '{filename}' ({len(file_bytes)} bytes, {report.get('total_pages', 0)} páginas)"

    if not review["is_valid"]:
        await db.execute(
            """INSERT INTO auditoria_dmz (id, evento, categoria, estado, motivo)
               VALUES ($1, $2, $3, 'RECHAZADO', $4)""",
            str(uuid.uuid4()), evento, categoria, review["reason"],
        )
        return {"approved": False, "message": review["reason"], "report": report}

    categoria_final = review.get("category") or categoria
    await db.execute(
        """INSERT INTO auditoria_dmz (id, evento, categoria, estado, motivo)
           VALUES ($1, $2, $3, 'APROBADO', $4)""",
        str(uuid.uuid4()), evento, categoria_final, review["reason"],
    )

    metadata = {
        "fuente": (fuente or "").strip() or filename,
        "autor": (autor or "").strip() or "Académico UPEC",
        "archivo_origen": filename,
        "paginas": report.get("total_pages"),
    }
    if url and url.strip():
        metadata["url"] = url.strip()[:500]

    job_id = str(uuid.uuid4())
    await _set_job(job_id, status="indexing", total=0, done=0, filename=filename, category=categoria_final)
    task = asyncio.create_task(_index_document(job_id, full_text, categoria_final, metadata, current_admin["email"]))
    _ingest_tasks.add(task)
    task.add_done_callback(_ingest_tasks.discard)

    return {
        "approved": True,
        "message": review["reason"],
        "category": categoria_final,
        "report": report,
        "job_id": job_id,
    }


@router.get("/ingest-jobs/{job_id}")
async def ingest_job_status(job_id: str, current_admin: dict = Depends(get_current_admin_user)):
    """Progreso de la indexación de un documento aprobado."""
    if redis_cache.redis is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El seguimiento de la indexación no está disponible.")
    data = await redis_cache.redis.hgetall(f"ingest_job:{job_id}")
    if not data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Indexación no encontrada o caducada.")
    for k in ("total", "done", "fragments", "pending"):
        if k in data:
            data[k] = int(data[k])
    return data


@router.get("/knowledge")
async def list_knowledge_fragments(
    category: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Lista fragmentos de conocimiento vectoriales almacenados en el RAG."""
    if category and category != "all":
        rows = await db.fetch(
            """SELECT id_fragmento, categoria, contenido, metadata, created_at
               FROM fragmentos_conocimiento
               WHERE categoria = $1
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3""",
            category, limit, offset
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM fragmentos_conocimiento WHERE categoria = $1", category
        ) or 0
    else:
        rows = await db.fetch(
            """SELECT id_fragmento, categoria, contenido, metadata, created_at
               FROM fragmentos_conocimiento
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2""",
            limit, offset
        )
        total = await get_fragment_count()

    results = []
    for r in rows:
        meta = r["metadata"]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        results.append({
            "id": str(r["id_fragmento"]),
            "categoria": r["categoria"],
            "contenido": r["contenido"],
            "metadata": meta,
            "createdAt": r["created_at"].isoformat() if r["created_at"] else None
        })

    # Resumen para las métricas del panel: fragmentos por categoría y documentos distintos
    by_category = await db.fetch(
        """SELECT categoria, COUNT(*) AS n FROM fragmentos_conocimiento
           GROUP BY categoria ORDER BY n DESC"""
    )
    sources = await db.fetchval(
        "SELECT COUNT(DISTINCT metadata->>'fuente') FROM fragmentos_conocimiento WHERE metadata->>'fuente' IS NOT NULL"
    ) or 0
    grand_total = sum(r["n"] for r in by_category)

    return {
        "total": total,
        "items": results,
        "summary": {
            "total": grand_total,
            "sources": sources,
            "categories": [{"categoria": r["categoria"], "count": r["n"]} for r in by_category],
        },
    }


@router.delete("/knowledge/{id_fragmento}")
async def delete_knowledge_fragment(
    id_fragmento: str,
    current_admin: dict = Depends(get_current_admin_user)
):
    """Elimina un fragmento de conocimiento del RAG y limpia el caché."""
    result = await db.execute(
        "DELETE FROM fragmentos_conocimiento WHERE id_fragmento = $1::uuid",
        id_fragmento
    )
    if "DELETE 0" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fragmento no encontrado."
        )

    await redis_cache.invalidate_responses()
    logger.info("Admin %s elimino fragmento RAG: %s", current_admin["email"], id_fragmento)
    return {"message": "Fragmento eliminado con éxito."}
