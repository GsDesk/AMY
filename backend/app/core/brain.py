"""
AMY -- Cerebro del Tutor (Orquestador)
Coordina el flujo completo: RAG -> Prompt -> Ollama/Mistral -> Guardrails.
Detecta consultas sobre relaciones de tablas para activar el panel interactivo.
"""

import logging
from app.rag.retriever import semantic_search
from app.integrations.groq_client import groq_client
from app.core.guardrails import SYSTEM_PROMPT, validate_response, sanitize_rag_context
from app.core.prompts import build_rag_prompt
from app.core.examples import detect_example
from app.core.db_model_detector import detect_db_model
from app.cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class TutorBrain:
    """
    Orquestador principal de AMY.
    Pipeline: Query -> Retriever (RAG) -> Prompt Builder -> Mistral -> Guardrails -> Response
    """

    async def think(self, student_query: str, chat_history: list[dict] = None) -> dict:
        """Procesa una consulta del estudiante a traves del pipeline RAG completo con generación dinámica."""
        rag_context_used = False
        
        # Generar un hash simple del historial para usar como contexto en Redis
        history_context = ""
        if chat_history:
            history_context = str([msg["content"] for msg in chat_history])

        query_clean = student_query.strip().lower()
        greetings = ["hola", "buenos dias", "buenas tardes", "buenas noches", "saludos", "hola amy", "como estas", "que tal", "buen dia"]
        is_greeting = any(query_clean == g or query_clean.startswith(g + " ") or query_clean.startswith(g + ",") for g in greetings)

        try:
            # 1. Cargar caché de Redis SOLO si no es un saludo simple (para garantizar variación en saludos)
            if not is_greeting:
                cached_response = await redis_cache.get_cached_response(student_query, context=history_context)
                if cached_response is not None:
                    return cached_response

            # Paso 1: Búsqueda Híbrida (RAG)
            context_fragments = await semantic_search(student_query)
            rag_context_used = len(context_fragments) > 0

            # Paso 1b: Sanitización anti Prompt Injection del contexto RAG
            if context_fragments:
                context_fragments = sanitize_rag_context(context_fragments)

            # Paso 2: Construcción del Prompt
            enriched_prompt = build_rag_prompt(student_query, context_fragments, chat_history=chat_history)

            # Paso 3: Generación Dinámica con LLM (Groq API con fallback transparente a Ollama local)
            from datetime import datetime, timezone, timedelta
            from app.integrations.ollama_client import ollama_client
            from app.config import settings

            ecuador = timezone(timedelta(hours=-5))
            fecha_actual = datetime.now(ecuador).strftime('%A %d de %B del %Y, %H:%M')
            
            if is_greeting:
                system_con_fecha = 'Eres AMY, la tutora virtual de Fundamentos de Bases de Datos de la UPEC. Responde al saludo del estudiante de forma cálida, humana, breve y fresca. FORMATO JSON OBLIGATORIO: {"analysis": "Saludo", "feedback": "Tu mensaje cordial de bienvenida", "topic": "Saludos"}'
            else:
                system_con_fecha = SYSTEM_PROMPT + f' La fecha y hora actual en Ecuador es: {fecha_actual}.'

            raw_response = None
            llm_source = "groq-llama3"

            if settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip():
                try:
                    logger.info("Solicitando respuesta a Groq API...")
                    raw_response = await groq_client.generate(
                        prompt=enriched_prompt,
                        system=system_con_fecha
                    )
                except Exception as e:
                    logger.warning("Fallo en Groq API (%s). Activando fallback a Ollama local...", e)
                    raw_response = None

            if not raw_response:
                logger.info("Generando respuesta a través de Ollama local (Mistral)...")
                try:
                    raw_response = await ollama_client.generate(
                        prompt=enriched_prompt,
                        system=system_con_fecha
                    )
                    llm_source = "ollama-mistral"
                except Exception as e:
                    logger.error("Error definitivo en ambos proveedores LLM (Groq y Ollama): %s", e)
                    raise

            # Paso 4: Guardrails (Validacion)
            result = validate_response(raw_response)
            result["source"] = llm_source
            result["rag_context_used"] = rag_context_used
            # Exponer fuentes RAG al frontend (para panel glassmórfico)
            result["rag_sources"] = [
                {
                    "id": f.get("id_fragmento"),
                    "categoria": f.get("categoria"),
                    "contenido": f.get("contenido", "")[:300],  # truncar para la UI
                    "metadata": f.get("metadata", {}),
                    "similarity": round(f.get("similarity", 0.0), 4),
                    "rrf_score": round(f.get("rrf_score", 0.0), 4),
                }
                for f in context_fragments
            ] if rag_context_used else []

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
