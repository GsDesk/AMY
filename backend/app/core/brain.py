"""
AMY -- Cerebro del Tutor (Orquestador)
Coordina el flujo completo: RAG -> Prompt -> Ollama/Mistral -> Guardrails.
Detecta consultas sobre relaciones de tablas para activar el panel interactivo.
"""

import logging
from app.rag.retriever import semantic_search
from app.integrations.groq_client import groq_client
from app.core.guardrails import SYSTEM_PROMPT, validate_response
from app.core.prompts import build_rag_prompt
from app.core.examples import detect_example
from app.core.db_model_detector import detect_db_model

logger = logging.getLogger(__name__)


class TutorBrain:
    """
    Orquestador principal de AMY.
    Pipeline: Query -> Retriever (RAG) -> Prompt Builder -> Mistral -> Guardrails -> Response
    """

    async def think(self, student_query: str, chat_history: list[dict] = None) -> dict:
        """Procesa una consulta del estudiante a traves del pipeline RAG completo, incluyendo el historial."""
        rag_context_used = False
        
        # Generar un hash simple del historial para usar como contexto en Redis
        history_context = ""
        if chat_history:
            history_context = str([msg["content"] for msg in chat_history])

        try:
            # 1. Intentar obtener respuesta desde el caché de Redis
            from app.cache.redis_cache import redis_cache
            cached_response = await redis_cache.get_cached_response(student_query, context=history_context)
            if cached_response is not None:
                return cached_response

            # Paso 1: Busqueda Semantica (RAG)
            context_fragments = await semantic_search(student_query)
            rag_context_used = len(context_fragments) > 0

            # Paso 2: Construccion del Prompt
            enriched_prompt = build_rag_prompt(student_query, context_fragments, chat_history=chat_history)

            # Paso 3: Generacion con Mistral
            from datetime import datetime
            from datetime import timezone, timedelta
            ecuador = timezone(timedelta(hours=-5))
            fecha_actual = datetime.now(ecuador).strftime('%A %d de %B del %Y, %H:%M')
            system_con_fecha = SYSTEM_PROMPT + f' La fecha y hora actual en Ecuador es: {fecha_actual}.'
            raw_response = await groq_client.generate(
                prompt=enriched_prompt,
                system=system_con_fecha
            )

            # Paso 4: Guardrails (Validacion)
            logger.info(f"RAW GROQ FULL: {repr(raw_response[:1000])}")
            result = validate_response(raw_response)
            result["source"] = "groq-llama3"
            result["rag_context_used"] = rag_context_used

            # Paso 5: Deteccion de ejemplo interactivo
            topic = result.get("topic", "")
            live_example = detect_example(student_query, topic)
            if live_example:
                result["live_example"] = live_example
                logger.info(f"Ejemplo interactivo activado: {live_example['title']}")
            else:
                fb = result.get("feedback", "")
                logger.info(f"DETECTOR feedback[:200]: {fb[:200]}")
                db_model = detect_db_model(student_query, fb)
                if db_model:
                    result["live_example"] = db_model
                    logger.info(f"Modelo BD generado: {db_model['title']}")

            # 2. Guardar la respuesta en caché si no es un error
            if result.get("source") != "error":
                await redis_cache.cache_response(student_query, result, context=history_context)

            return result

        except Exception as e:
            logger.error(f"Error en el pipeline del cerebro: {e}")
            return {
                "analysis": "Error interno en el procesamiento.",
                "feedback": "Lo siento, tuve un problema al procesar tu pregunta. Verifica que Ollama este activo.",
                "topic": "Error",
                "source": "error",
                "rag_context_used": False
            }



# Instancia global del cerebro
brain = TutorBrain()
