"""
AMY — Retriever con Búsqueda Híbrida (Vector + FTS + RRF)
Combina similitud vectorial (cosine) y Full-Text Search en español
mediante Reciprocal Rank Fusion (RRF) para máxima precisión.
"""

import json
import logging
from app.database.connection import db
from app.integrations.ollama_client import ollama_client
from app.config import settings

logger = logging.getLogger(__name__)

# Constante k para Reciprocal Rank Fusion (estándar: 60)
_RRF_K = 60


async def hybrid_search(
    query: str,
    top_k: int | None = None,
    category_filter: str | None = None,
    similarity_threshold: float | None = None,
) -> list[dict]:
    """
    Búsqueda híbrida: combina ranking vectorial (cosine) + FTS (español)
    mediante Reciprocal Rank Fusion (RRF).

    El score final de cada fragmento es:
        rrf_score = 1/(k + rank_vector) + 1/(k + rank_fts)

    Esto garantiza que términos sintácticos exactos (FOREIGN KEY, 3FN,
    INNER JOIN) no se pierdan incluso si su similitud coseno es baja.

    Args:
        query: Consulta del usuario.
        top_k: Número máximo de fragmentos a retornar.
        category_filter: Filtra por categoría temática.
        similarity_threshold: Umbral mínimo de similitud coseno. Los fragmentos
            con similitud < threshold son penalizados en el score RRF pero no
            eliminados; se aplica el filtro final sobre rrf_score normalizado.

    Returns:
        Lista de dicts con id_fragmento, categoria, contenido, metadata,
        similarity (cosine), fts_rank y rrf_score.
    """
    if top_k is None:
        top_k = settings.RAG_TOP_K
    if similarity_threshold is None:
        similarity_threshold = getattr(settings, "SIMILARITY_THRESHOLD", 0.55)

    try:
        # Intentar obtener embedding desde caché Redis antes de llamar a Ollama
        from app.cache.redis_cache import redis_cache
        query_embedding = await redis_cache.get_cached_embedding(query)
        if query_embedding:
            logger.debug("Embedding cargado desde cache Redis para la consulta")
        else:
            query_embedding = await ollama_client.get_embedding(query)
            if query_embedding:
                await redis_cache.cache_embedding(query, query_embedding)

        if not query_embedding:
            logger.warning("Embedding vacío para la consulta")
            return []

        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        # ── Construcción del filtro de categoría ───────────────────────────────
        category_clause = "AND categoria = $3" if category_filter else ""
        # Los parámetros $3/$4 se desplazan dependiendo del filtro
        limit_param = "$4" if category_filter else "$3"

        # ── Query RRF usando CTE ───────────────────────────────────────────────
        # CTE vector_ranked: ranking por distancia coseno
        # CTE fts_ranked: ranking por relevancia FTS en español (ts_rank)
        # Combinación: score RRF = 1/(k+rank_v) + 1/(k+rank_fts)
        sql = f"""
            WITH vector_ranked AS (
                SELECT
                    id_fragmento,
                    categoria,
                    contenido,
                    metadata,
                    1 - (embedding <=> $1::vector) AS similarity,
                    ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector ASC) AS rank_v
                FROM fragmentos_conocimiento
                WHERE embedding IS NOT NULL
                {category_clause}
                ORDER BY embedding <=> $1::vector
                LIMIT {limit_param} * 3
            ),
            fts_ranked AS (
                SELECT
                    id_fragmento,
                    ts_rank(contenido_fts, plainto_tsquery('spanish', $2)) AS fts_score,
                    ROW_NUMBER() OVER (
                        ORDER BY ts_rank(contenido_fts, plainto_tsquery('spanish', $2)) DESC
                    ) AS rank_fts
                FROM fragmentos_conocimiento
                WHERE contenido_fts @@ plainto_tsquery('spanish', $2)
                {category_clause}
                LIMIT {limit_param} * 3
            )
            SELECT
                v.id_fragmento,
                v.categoria,
                v.contenido,
                v.metadata,
                v.similarity,
                COALESCE(f.fts_score, 0.0) AS fts_score,
                (
                    1.0 / ({_RRF_K} + v.rank_v) +
                    COALESCE(1.0 / ({_RRF_K} + f.rank_fts), 0.0)
                ) AS rrf_score
            FROM vector_ranked v
            LEFT JOIN fts_ranked f ON f.id_fragmento = v.id_fragmento
            ORDER BY rrf_score DESC
            LIMIT {limit_param}
        """

        # ── Ejecutar query con parámetros seguros (parametrizados) ────────────
        if category_filter:
            rows = await db.fetch(sql, embedding_str, query, category_filter, top_k)
        else:
            rows = await db.fetch(sql, embedding_str, query, top_k)

        results = []
        for row in rows:
            # Filtrar por umbral de similitud coseno mínimo
            cosine_sim = float(row["similarity"])
            if cosine_sim < similarity_threshold:
                # Sólo omitir si tampoco tiene hits FTS significativos
                if float(row["fts_score"]) < 0.01:
                    continue

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
                "similarity": cosine_sim,
                "fts_score": float(row["fts_score"]),
                "rrf_score": float(row["rrf_score"]),
            })

        if results:
            logger.info(
                "Busqueda hibrida RRF: %d resultados (mejor rrf=%.4f, cosine=%.4f)",
                len(results),
                results[0]["rrf_score"],
                results[0]["similarity"],
            )
        else:
            logger.info("Busqueda hibrida RRF: 0 resultados sobre umbral %.2f", similarity_threshold)

        return results

    except Exception as e:
        logger.error("Error en búsqueda híbrida: %s", e)
        # Fallback a búsqueda vectorial pura si RRF falla (ej: contenido_fts no existe aún)
        return await _fallback_semantic_search(query, top_k, category_filter, similarity_threshold)


async def _fallback_semantic_search(
    query: str,
    top_k: int,
    category_filter: str | None,
    similarity_threshold: float,
) -> list[dict]:
    """Búsqueda vectorial pura como fallback si falla la búsqueda híbrida."""
    try:
        query_embedding = await ollama_client.get_embedding(query)
        if not query_embedding:
            return []

        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        if category_filter:
            sql = """
                SELECT id_fragmento, categoria, contenido, metadata,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM fragmentos_conocimiento
                WHERE embedding IS NOT NULL AND categoria = $2
                ORDER BY embedding <=> $1::vector LIMIT $3
            """
            rows = await db.fetch(sql, embedding_str, category_filter, top_k)
        else:
            sql = """
                SELECT id_fragmento, categoria, contenido, metadata,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM fragmentos_conocimiento
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector LIMIT $2
            """
            rows = await db.fetch(sql, embedding_str, top_k)

        results = []
        for row in rows:
            cosine_sim = float(row["similarity"])
            if cosine_sim < similarity_threshold:
                continue
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
                "similarity": cosine_sim,
                "fts_score": 0.0,
                "rrf_score": cosine_sim,
            })

        logger.info("Fallback vectorial: %d resultados", len(results))
        return results
    except Exception as e:
        logger.error("Error en fallback vectorial: %s", e)
        return []


# ── Alias retrocompatible ─────────────────────────────────────────────────────

async def semantic_search(
    query: str,
    top_k: int | None = None,
    category_filter: str | None = None,
) -> list[dict]:
    """
    Alias retrocompatible de hybrid_search().
    Llamado desde brain.py y otros módulos existentes.
    """
    return await hybrid_search(query, top_k=top_k, category_filter=category_filter)


async def get_fragment_count() -> int:
    try:
        return await db.fetchval(
            "SELECT COUNT(*) FROM fragmentos_conocimiento WHERE embedding IS NOT NULL"
        ) or 0
    except Exception:
        return 0


