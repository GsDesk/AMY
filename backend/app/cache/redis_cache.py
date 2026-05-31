"""
AMY — Controlador de Caché con Redis
Maneja almacenamiento en memoria para embeddings y respuestas del chat con degradación elegante.
"""

import hashlib
import json
import logging
from typing import Optional
import redis.asyncio as aioredis
from app.config import settings


logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self.enabled = False

    async def connect(self):
        try:
            self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            # Ping para verificar conexion real
            await self.redis.ping()
            self.enabled = True
            logger.info(f"Conectado a Redis con éxito: {settings.REDIS_URL}")
        except Exception as e:
            self.enabled = False
            self.redis = None
            logger.error(f"No se pudo conectar a Redis: {e}. El sistema funcionará SIN caché (degradación elegante).")

    async def disconnect(self):
        if self.redis:
            try:
                await self.redis.close()
                logger.info("Desconectado de Redis")
            except Exception as e:
                logger.error(f"Error cerrando conexión de Redis: {e}")
            finally:
                self.redis = None
                self.enabled = False

    async def is_healthy(self) -> bool:
        if not self.enabled or not self.redis:
            return False
        try:
            return await self.redis.ping() == True
        except Exception:
            return False

    def _get_embedding_key(self, text: str) -> str:
        """Genera una clave única para el embedding de un texto."""
        text_hash = hashlib.md5(text.strip().encode("utf-8")).hexdigest()
        return f"emb:{text_hash}"

    def _get_response_key(self, query: str, context: str = "") -> str:
        """Genera una clave única para la respuesta de una consulta y su contexto."""
        combined = (query.strip().lower() + context).encode("utf-8")
        query_hash = hashlib.md5(combined).hexdigest()
        return f"resp:{query_hash}"

    # ── Métodos para Embeddings ──────────────────────────────────
    async def get_cached_embedding(self, text: str) -> Optional[list[float]]:
        if not self.enabled or not self.redis:
            return None
        try:
            key = self._get_embedding_key(text)
            cached = await self.redis.get(key)
            if cached:
                logger.debug("Embedding cargado desde caché Redis")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Error leyendo embedding de Redis: {e}")
        return None

    async def cache_embedding(self, text: str, embedding: list[float], ttl: int = 604800):
        """Guarda el embedding en caché. Expiración por defecto: 7 días."""
        if not self.enabled or not self.redis:
            return
        try:
            key = self._get_embedding_key(text)
            await self.redis.setex(key, ttl, json.dumps(embedding))
            logger.debug("Embedding guardado en caché Redis")
        except Exception as e:
            logger.warning(f"Error escribiendo embedding en Redis: {e}")

    # ── Métodos para Respuestas del Chat ──────────────────────────
    async def get_cached_response(self, query: str, context: str = "") -> Optional[dict]:
        if not self.enabled or not self.redis:
            return None
        try:
            key = self._get_response_key(query, context)
            cached = await self.redis.get(key)
            if cached:
                logger.info("Respuesta de chat cargada desde caché Redis (Hit)")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Error leyendo respuesta de Redis: {e}")
        return None

    async def cache_response(self, query: str, response: dict, ttl: int = 3600, context: str = ""):
        """Guarda la respuesta en caché. Expiración por defecto: 1 hora."""
        if not self.enabled or not self.redis:
            return
        try:
            key = self._get_response_key(query, context)
            # Guardamos la respuesta como string JSON
            await self.redis.setex(key, ttl, json.dumps(response))
            logger.info("Respuesta de chat guardada en caché Redis (Miss)")
        except Exception as e:
            logger.warning(f"Error escribiendo respuesta en Redis: {e}")

    async def invalidate_responses(self) -> int:
        """Busca todas las respuestas en caché (resp:*) y las elimina. Mantiene los embeddings."""
        if not self.enabled or not self.redis:
            return 0
        try:
            count = 0
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(cursor=cursor, match="resp:*", count=100)
                if keys:
                    await self.redis.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
            if count > 0:
                logger.info(f"Invalidadas {count} respuestas de chat en caché por actualización RAG")
            return count
        except Exception as e:
            logger.error(f"Error invalidando caché de respuestas: {e}")
            return 0


# Instancia única global de caché
redis_cache = RedisCache()
