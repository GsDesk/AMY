"""
AMY — Cliente Ollama
Cliente asincrono para comunicarse con Ollama (Mistral).
"""

import httpx
import logging
from app.config import settings

logger = logging.getLogger(__name__)


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
            response = await self.client.post("/api/generate", json={
                "model": self.model,
                "prompt": prompt,
                "system": system,
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0.15,       # Temperatura muy baja para respuestas precisas y rapidas
                    "top_p": 0.80,
                    "num_predict": 280,        # Tokens reducidos para mayor velocidad en CPU
                    "num_thread": 6,           # Mas hilos para CPU
                    "repeat_penalty": 1.1,     # Evitar bucles de texto
                    "stop": ["```", "\n\n\n"]  # Cortar generacion innecesaria
                }
            })
            response.raise_for_status()
            result = response.json().get("response", "")
            logger.info(f"Respuesta recibida de Ollama ({len(result)} caracteres)")
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
