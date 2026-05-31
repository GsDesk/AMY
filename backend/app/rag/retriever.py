"""
AMY — Retriever (Buscador Semantico)
Busqueda de similitud vectorial en pgvector.
"""

import json
import logging
from app.database.connection import db
from app.integrations.ollama_client import ollama_client
from app.config import settings

logger = logging.getLogger(__name__)


async def semantic_search(query: str, top_k: int | None = None, category_filter: str | None = None) -> list[dict]:
    if top_k is None:
        top_k = settings.RAG_TOP_K
    try:
        query_embedding = await ollama_client.get_embedding(query)
        if not query_embedding:
            logger.warning("Embedding vacio para la consulta")
            return []

        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        if category_filter:
            sql = """
                SELECT id_fragmento, categoria, contenido, metadata,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM fragmentos_conocimiento WHERE embedding IS NOT NULL AND categoria = $2
                ORDER BY embedding <=> $1::vector LIMIT $3
            """
            rows = await db.fetch(sql, embedding_str, category_filter, top_k)
        else:
            sql = """
                SELECT id_fragmento, categoria, contenido, metadata,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM fragmentos_conocimiento WHERE embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector LIMIT $2
            """
            rows = await db.fetch(sql, embedding_str, top_k)

        results = []
        for row in rows:
            metadata = row["metadata"]
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}
            results.append({
                "id_fragmento": str(row["id_fragmento"]),
                "categoria": row["categoria"],
                "contenido": row["contenido"],
                "metadata": metadata,
                "similarity": float(row["similarity"])
            })

        if results:
            logger.info(f"Busqueda semantica: {len(results)} resultados (similitud max: {results[0]['similarity']:.4f})")
        else:
            logger.info("Busqueda semantica: 0 resultados")
        return results
    except Exception as e:
        logger.error(f"Error en busqueda semantica: {e}")
        return []


async def get_fragment_count() -> int:
    try:
        return await db.fetchval("SELECT COUNT(*) FROM fragmentos_conocimiento WHERE embedding IS NOT NULL") or 0
    except Exception:
        return 0
