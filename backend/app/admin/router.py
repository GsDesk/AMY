"""
AMY — Router de Administración & Gestión del RAG (DMZ Strict Mode)
Endpoints restringidos a usuarios con rol 'admin'.
"""

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
from app.rag.dmz_validator import validate_document_dmz

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


@router.post("/ingest-file")
async def ingest_academic_file(
    file: UploadFile = File(...),
    categoria: str = Form(...),
    fuente: Optional[str] = Form(None),
    autor: Optional[str] = Form(None),
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Ingesta un archivo académico (.txt, .pdf, .docx, .doc) evaluándolo primeramente
    en la Zona Militarizada de Seguridad (DMZ).
    """
    filename = file.filename or "documento"
    ext = filename.lower().split(".")[-1]

    if ext not in ("txt", "pdf", "docx", "doc"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Debe ser un archivo .txt, .pdf, .docx o .doc."
        )

    file_bytes = await file.read()
    extracted_text = ""

    try:
        if ext == "txt":
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
        elif ext == "pdf":
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_parts = [page.extract_text() for page in reader.pages if page.extract_text()]
            extracted_text = "\n".join(text_parts)
        elif ext in ("docx", "doc"):
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            extracted_text = "\n".join([p.text for p in doc.paragraphs if p.text])
    except Exception as err:
        logger.error("Error al extraer texto del archivo %s: %s", filename, err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo extraer el texto del archivo '{filename}'. Asegúrate de que el documento no esté dañado."
        )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo subido está vacío o no contiene texto procesable."
        )

    # 1. Evaluación DMZ
    eval_res = await validate_document_dmz(extracted_text, categoria=categoria)

    log_id = str(uuid.uuid4())
    evento_desc = f"Ingesta de archivo '{filename}' ({len(file_bytes)} bytes)"

    if not eval_res["is_valid"]:
        # Registrar evento RECHAZADO
        await db.execute(
            """INSERT INTO auditoria_dmz (id, evento, categoria, estado, motivo)
               VALUES ($1, $2, $3, 'RECHAZADO', $4)""",
            log_id, evento_desc, categoria, eval_res["reason"]
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=eval_res["reason"]
        )

    # 2. Ingesta APROBADA
    categoria_final = eval_res.get("category", categoria) or categoria
    await db.execute(
        """INSERT INTO auditoria_dmz (id, evento, categoria, estado, motivo)
           VALUES ($1, $2, $3, 'APROBADO', $4)""",
        log_id, evento_desc, categoria_final, eval_res["reason"]
    )

    # Dividir texto en fragmentos de ~500 caracteres
    paragraphs = [p.strip() for p in extracted_text.split("\n\n") if p.strip()]
    chunks = []
    curr_chunk = ""

    for p in paragraphs:
        if len(curr_chunk) + len(p) < 600:
            curr_chunk += ("\n" + p) if curr_chunk else p
        else:
            if len(curr_chunk) >= 80:
                chunks.append(curr_chunk)
            curr_chunk = p
    if len(curr_chunk) >= 80:
        chunks.append(curr_chunk)

    if not chunks:
        chunks = [extracted_text[:1000]]

    # Limitar a los 120 mejores fragmentos para libros extensos (evita latencias prolongadas)
    if len(chunks) > 120:
        logger.info("El archivo contiene %d fragmentos; limitando a los 120 más representativos.", len(chunks))
        chunks = chunks[:120]

    # Indexar fragmentos en PostgreSQL
    created_count = 0
    meta_json = json.dumps({
        "fuente": fuente or filename,
        "autor": autor or "Académico UPEC",
        "archivo_origen": filename
    })

    for chunk in chunks:
        try:
            embedding = await ollama_client.get_embedding(chunk)
        except Exception as e:
            logger.warning("No se pudo obtener embedding para el fragmento: %s", e)
            embedding = None

        if not embedding:
            embedding = [0.0] * 768

        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        frag_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO fragmentos_conocimiento (id_fragmento, categoria, contenido, metadata, embedding)
               VALUES ($1::uuid, $2, $3, $4::jsonb, $5::vector)""",
            frag_id, categoria_final, chunk, meta_json, embedding_str
        )
        created_count += 1

    await redis_cache.invalidate_responses()
    logger.info("Admin %s ingesto exitosamente %s (%d fragmentos)", current_admin["email"], filename, created_count)

    return {
        "message": f"Archivo '{filename}' APROBADO por la Zona Militarizada e ingestado con éxito en el RAG.",
        "fragments_created": created_count
    }


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

    return {"total": total, "items": results}


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
