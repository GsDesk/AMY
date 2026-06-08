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
            timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0)
        )

    async def generate(self, prompt: str, system: str = "") -> str:
        try:
            logger.info(f"Enviando consulta a Ollama ({self.model})...")
            response = await self.client.post("/api/generate", json={
                "model": self.model, "prompt": prompt, "system": system,
                "format": "json", "stream": False,
                "options": {"temperature": 0.7, "top_p": 0.9, "num_predict": 1024}
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
        try:
            response = await self.client.post("/api/embeddings", json={
                "model": "nomic-embed-text", "prompt": text
            })
            response.raise_for_status()
            embedding = response.json().get("embedding", [])
            if len(embedding) != settings.EMBEDDING_DIM:
                logger.warning(f"Dimension de embedding inesperada: {len(embedding)} (esperado: {settings.EMBEDDING_DIM})")
            return embedding
        except Exception as e:
            logger.error(f"Error generando embedding: {e}")
            raise

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
