"""
AMY — Cliente Ollama
Cliente asincrono para comunicarse con Ollama (Mistral).
"""

import httpx
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Prompt simplificado para Ollama (CPU). Mucho mas corto que SYSTEM_PROMPT
# para reducir tokens de entrada y acelerar la inferencia.
OLLAMA_SYSTEM = (
    'Eres AMY, tutora de Bases de Datos de la UPEC. '
    'Responde SOLO con JSON valido sin markdown, con estas claves exactas: '
    '{"analysis":"...","feedback":"Respuesta en Markdown","topic":"SQL|Modelo E-R|Normalizacion|Fundamentos|Saludos|General|Fuera de Alcance","live_example":null}. '
    'Cuando el usuario pida un diagrama E-R o tablas, incluye en live_example: '
    '{"type":"er_diagram","title":"...","cardinality":"1:N","description":"...","mermaid_code":"erDiagram\\n...","tables":[{"name":"...","columns":[{"name":"...","type":"INT","isPk":true}]}]}. '
    'Responde SOLO en JSON, sin texto fuera del JSON.'
)


class OllamaClient:
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.client = httpx.AsyncClient(
            base_url=self.host,
            timeout=httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=30.0)
        )

    async def generate(self, prompt: str, system: str = "") -> str:
        try:
            logger.info(f"Enviando consulta a Ollama ({self.model})...")
            # Usamos OLLAMA_SYSTEM (simplificado) en lugar del system externo
            # para garantizar JSON valido y respuestas mas rapidas en CPU
            response = await self.client.post("/api/generate", json={
                "model": self.model,
                "prompt": prompt,
                "system": OLLAMA_SYSTEM,
                "stream": False,
                "format": "json",     # Forzar JSON valido desde Ollama
                "options": {
                    "temperature": 0.2,    # Muy baja para respuestas JSON precisas
                    "top_p": 0.80,
                    "num_predict": 500,    # Reducido: suficiente para respuestas pedagogicas
                    "num_thread": 6,       # Hilos para CPU
                    "repeat_penalty": 1.1  # Evitar bucles de texto
                }
            })
            response.raise_for_status()
            result = response.json().get("response", "")
            logger.info(f"Respuesta recibida de Ollama ({len(result)} caracteres)")
            # Validar que no sea cadena vacia o muy corta
            if not result or len(result.strip()) < 10:
                logger.warning("Ollama devolvio respuesta vacia o muy corta")
                return ""
            return result
        except httpx.TimeoutException:
            logger.error("Timeout al comunicarse con Ollama")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"Error HTTP de Ollama: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"Error inesperado con Ollama: {e}")
            raise

    async def get_embedding(self, text: str) -> list[float]:
        """Obtiene el vector de embedding usando nomic-embed-text o el modelo local como fallback."""
        for embed_model in ["nomic-embed-text", self.model]:
            try:
                response = await self.client.post("/api/embeddings", json={
                    "model": embed_model, "prompt": text
                })
                if response.status_code == 200:
                    embedding = response.json().get("embedding", [])
                    if embedding:
                        return embedding
            except Exception as e:
                logger.warning(f"No se pudo generar embedding con '{embed_model}': {e}")
        logger.error("No se pudo obtener embedding con ningún modelo disponible en Ollama")
        return []

    async def is_healthy(self) -> bool:
        try:
            response = await self.client.get("/api/tags")
            if response.status_code != 200:
                return False
            models = [m.get("name", "") for m in response.json().get("models", [])]
            available = any(self.model in m for m in models)
            if not available:
                logger.warning(f"Modelo '{self.model}' no encontrado. Disponibles: {models}")
            return available
        except Exception:
            return False

    async def close(self):
        await self.client.aclose()


ollama_client = OllamaClient()
