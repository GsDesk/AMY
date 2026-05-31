"""
AMY — Generacion de Embeddings
Genera vectores de 4096 dimensiones usando Mistral via Ollama.
"""

import logging
from app.integrations.ollama_client import ollama_client
from app.database.connection import db
from app.core.prompts import build_embedding_prompt
from app.cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)


async def generate_embedding(text: str) -> list[float]:
    cleaned_text = build_embedding_prompt(text)
    
    # 1. Intentar obtener el embedding desde el caché de Redis
    cached = await redis_cache.get_cached_embedding(cleaned_text)
    if cached is not None:
        return cached

    # 2. Si no está en caché, generarlo llamando a Ollama
    embedding = await ollama_client.get_embedding(cleaned_text)
    
    # 3. Guardar el embedding generado en Redis para futuras peticiones
    await redis_cache.cache_embedding(cleaned_text, embedding)
    
    return embedding



async def compute_missing_embeddings() -> int:
    rows = await db.fetch(
        "SELECT id_fragmento, contenido FROM fragmentos_conocimiento WHERE embedding IS NULL"
    )
    if not rows:
        logger.info("Todos los fragmentos ya tienen embeddings")
        return 0

    logger.info(f"Generando embeddings para {len(rows)} fragmentos...")
    processed = 0

    for row in rows:
        try:
            embedding = await generate_embedding(row["contenido"])
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
            await db.execute(
                "UPDATE fragmentos_conocimiento SET embedding = $1::vector, updated_at = NOW() WHERE id_fragmento = $2",
                embedding_str, row["id_fragmento"]
            )
            processed += 1
            logger.info(f"  [{processed}/{len(rows)}] Embedding generado para fragmento {row['id_fragmento']}")
        except Exception as e:
            logger.error(f"  Error procesando fragmento {row['id_fragmento']}: {e}")
            continue

    if processed > 0:
        try:
            idx_exists = await db.fetchval(
                "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_embedding_hnsw')"
            )
            if not idx_exists:
                await db.execute(
                    "CREATE INDEX idx_embedding_hnsw ON fragmentos_conocimiento "
                    "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
                )
                logger.info("Indice HNSW creado para busqueda vectorial")
        except Exception as e:
            logger.warning(f"No se pudo crear indice HNSW: {e}")

    logger.info(f"Embeddings completados: {processed}/{len(rows)}")
    return processed
