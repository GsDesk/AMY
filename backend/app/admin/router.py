"""
AMY — Router de Administración & Gestión del RAG
Endpoints restringidos a usuarios con rol 'admin'.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_admin_user
from app.database.connection import db
from app.integrations.ollama_client import ollama_client
from app.cache.redis_cache import redis_cache
from app.rag.retriever import get_fragment_count

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UpdateRoleRequest(BaseModel):
    rol: str


@router.get("/stats")
async def get_admin_stats(current_admin: dict = Depends(get_current_admin_user)):
    """Retorna métricas consolidadas del sistema para el panel de administración."""
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


@router.get("/users")
async def list_users(current_admin: dict = Depends(get_current_admin_user)):
    """Retorna el listado de todos los usuarios registrados."""
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
            detail="Rol invalido. Debe ser 'estudiante' o 'admin'."
        )

    # Evitar despromoverse a sí mismo si es el único admin
    if user_id == current_admin["id"] and body.rol != "admin":
        admin_count = await db.fetchval("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'") or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes despromover el único administrador del sistema."
            )

    await db.execute(
        "UPDATE usuarios SET rol = $1 WHERE id = $2",
        body.rol, user_id
    )
    logger.info("Admin %s cambio el rol del usuario %s a %s", current_admin["email"], user_id, body.rol)
    return {"message": f"Rol actualizado a '{body.rol}' con éxito."}


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

    import json
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
    """Elimina un fragmento de conocimiento del RAG y limpia el caché de respuestas."""
    result = await db.execute(
        "DELETE FROM fragmentos_conocimiento WHERE id_fragmento = $1::uuid",
        id_fragmento
    )
    if "DELETE 0" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fragmento no encontrado."
        )

    # Invalidad caché de chat en Redis
    await redis_cache.invalidate_responses()

    logger.info("Admin %s elimino fragmento RAG: %s", current_admin["email"], id_fragmento)
    return {"message": "Fragmento eliminado con éxito."}
