"""
AMY -- Schemas de Transporte (DTOs)
Define los contratos de entrada y salida de la API.
"""

from pydantic import BaseModel, Field
from typing import Optional


# -- Request Schemas ------------------------------------------

class ChatRequest(BaseModel):
    """Mensaje del estudiante hacia el tutor."""
    student_query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Consulta del estudiante sobre Bases de Datos."
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="ID de conversacion para persistir el mensaje (requiere autenticacion)."
    )


class IngestRequest(BaseModel):
    """Solicitud para ingestar un nuevo documento al sistema RAG."""
    contenido: str = Field(
        ...,
        min_length=10,
        description="Texto del documento a fragmentar e indexar."
    )
    categoria: str = Field(
        ...,
        description="Categoria tematica del contenido."
    )
    metadata: dict = Field(
        default_factory=dict,
        description="Metadatos adicionales (fuente, autor, etc.)."
    )


# -- Response Schemas -----------------------------------------

class ChatResponse(BaseModel):
    """Respuesta del tutor al estudiante."""
    analysis: str = Field(
        description="Diagnostico cognitivo interno de la duda del estudiante."
    )
    feedback: str = Field(
        description="Intervencion pedagogica socratica (preguntas y guias)."
    )
    topic: str = Field(
        default="General",
        description="Categoria tematica detectada."
    )
    source: str = Field(
        default="ollama-mistral",
        description="Motor de IA utilizado."
    )
    rag_context_used: bool = Field(
        default=False,
        description="Indica si se uso contexto RAG en la respuesta."
    )
    live_example: Optional[dict] = Field(
        default=None,
        description="Ejemplo interactivo de relacion entre tablas (si aplica)."
    )


class IngestResponse(BaseModel):
    """Resultado de la ingestion de un documento."""
    fragments_created: int = Field(
        description="Numero de fragmentos creados e indexados."
    )
    message: str = Field(
        description="Mensaje de confirmacion."
    )


class HealthResponse(BaseModel):
    """Estado de salud del sistema."""
    status: str
    database: str
    ollama: str
    redis: str
    model: str
    fragments_count: int = 0

