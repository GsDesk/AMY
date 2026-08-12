"""
AMY — Router de Administración & Gestión del RAG (DMZ Strict Mode)
Endpoints restringidos a usuarios con rol 'admin'.
"""

import io
import json
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_admin_user
from app.database.connection import db
from app.integrations.ollama_client import ollama_client
from app.cache.redis_cache import redis_cache
from app.rag.retriever import get_fragment_count
from app.rag.dmz_validator import validate_document_dmz

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UpdateRoleRequest(BaseModel):
    rol: str


@router.get("/stats")
async def get_admin_stats(current_admin: dict = Depends(get_current_admin_user)):
    """Retorna métricas consolidadas del sistema para el panel de administración."""
    # Asegurar que la tabla auditoria_dmz exista
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

    total_users = await db.fetchval("SELECT COUNT(*) FROM usuarios") or 0
    total_conversations = await db.fetchval("SELECT COUNT(*) FROM conversaciones") or 0
    total_messages = await db.fetchval("SELECT COUNT(*) FROM mensajes") or 0
    total_fragments = await get_fragment_count()

    db_ok = await db.is_healthy()
    ollama_ok = await ollama_client.is_healthy()
    redis_ok = await redis_cache.is_healthy()

    return {
        "usersCount": total_users,
        "conversationsCount": total_conversations,
        "messagesCount": total_messages,
        "fragmentsCount": total_fragments,
        "health": {
            "database": "connected" if db_ok else "disconnected",
            "ollama": "connected" if ollama_ok else "disconnected",
            "redis": "connected" if redis_ok else "disconnected",
        }
    }


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
