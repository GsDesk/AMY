"""
AMY -- Router de Conversaciones y Mensajes
CRUD de conversaciones e historial de mensajes del chat.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.auth.dependencies import get_current_user
from app.database.connection import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


# ── Schemas ──────────────────────────────────────────────────


class CreateConversationRequest(BaseModel):
    titulo: Optional[str] = None


class ConversationOut(BaseModel):
    id: str
    titulo: str
    created_at: str
    updated_at: str
    message_count: int


class ConversationCreated(BaseModel):
    id: str
    titulo: str
    created_at: str


class MessageOut(BaseModel):
    id: str
    sender: str
    content: str
    topic: Optional[str] = None
    source: Optional[str] = None
    rag_used: Optional[bool] = None
    live_example: Optional[str] = None
    attachment: Optional[str] = None
    rag_learned: Optional[bool] = None
    created_at: str


# ── Endpoints ────────────────────────────────────────────────


@router.get("/api/conversations", response_model=list[ConversationOut])
@router.get("/api/conversations/", response_model=list[ConversationOut], include_in_schema=False)
async def list_conversations(current_user: dict = Depends(get_current_user)):
    """Lista las conversaciones del usuario ordenadas por actividad reciente."""
    rows = await db.fetch(
        """SELECT c.id, c.titulo, c.created_at, c.updated_at,
                  COUNT(m.id) AS message_count
           FROM conversaciones c
           LEFT JOIN mensajes m ON m.conversacion_id = c.id
           WHERE c.usuario_id = $1
           GROUP BY c.id
           ORDER BY c.updated_at DESC""",
        current_user["id"],
    )
    return [
        ConversationOut(
            id=str(r["id"]),
            titulo=r["titulo"],
            created_at=r["created_at"].isoformat(),
            updated_at=r["updated_at"].isoformat(),
            message_count=r["message_count"],
        )
        for r in rows
    ]


@router.post("/api/conversations", response_model=ConversationCreated, status_code=status.HTTP_201_CREATED)
@router.post("/api/conversations/", response_model=ConversationCreated, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_conversation(
    body: CreateConversationRequest = CreateConversationRequest(),
    current_user: dict = Depends(get_current_user),
):
    """Crea una nueva conversacion."""
    conv_id = str(uuid.uuid4())
    titulo = body.titulo or "Nueva conversacion"
    now = datetime.now(timezone.utc)

    await db.execute(
        """INSERT INTO conversaciones (id, usuario_id, titulo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5)""",
        conv_id,
        current_user["id"],
        titulo,
        now,
        now,
    )

    logger.info("Conversacion creada: %s (usuario=%s)", conv_id, current_user["id"])
    return ConversationCreated(
        id=conv_id,
        titulo=titulo,
        created_at=now.isoformat(),
    )


@router.get("/api/conversations/{conversation_id}/messages", response_model=list[MessageOut])
@router.get("/api/conversations/{conversation_id}/messages/", response_model=list[MessageOut], include_in_schema=False)
async def get_conversation_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retorna los mensajes de una conversacion. Verifica pertenencia al usuario."""
    owner = await db.fetchval(
        "SELECT usuario_id FROM conversaciones WHERE id = $1",
        conversation_id,
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversacion no encontrada.",
        )
    if str(owner) != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta conversacion.",
        )

    rows = await db.fetch(
        """SELECT id, sender, content, topic, source, rag_used, live_example, attachment, rag_learned, created_at
           FROM mensajes
           WHERE conversacion_id = $1
           ORDER BY created_at ASC""",
        conversation_id,
    )
    return [
        MessageOut(
            id=str(r["id"]),
            sender=r["sender"],
            content=r["content"],
            topic=r.get("topic"),
            source=r.get("source"),
            rag_used=r.get("rag_used"),
            live_example=str(r["live_example"]) if r.get("live_example") else None,
            attachment=str(r["attachment"]) if r.get("attachment") else None,
            rag_learned=bool(r.get("rag_learned")) if r.get("rag_learned") is not None else None,
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


@router.delete("/api/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Elimina una conversacion y todos sus mensajes."""
    owner = await db.fetchval(
        "SELECT usuario_id FROM conversaciones WHERE id = $1",
        conversation_id,
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversacion no encontrada.",
        )
    if str(owner) != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta conversacion.",
        )

    await db.execute("DELETE FROM mensajes WHERE conversacion_id = $1", conversation_id)
    await db.execute("DELETE FROM conversaciones WHERE id = $1", conversation_id)
    logger.info("Conversacion eliminada: %s", conversation_id)
