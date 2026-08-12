"""
AMY — Cerebro del Tutor (Orquestador con Conmutación Inteligente por Tokens)
Coordina el flujo completo: RAG -> Prompt -> Groq (Llama 3.3) / Ollama (Mistral) -> Guardrails.
Soporta selección manual y conmutación automática cuando se agotan los tokens.
"""

import logging
from datetime import datetime, timezone, timedelta
from app.rag.retriever import semantic_search
from app.integrations.groq_client import groq_client
from app.integrations.ollama_client import ollama_client
from app.core.guardrails import SYSTEM_PROMPT, validate_response, sanitize_rag_context
from app.core.prompts import build_rag_prompt
from app.core.examples import detect_example
from app.cache.redis_cache import redis_cache
from app.config import settings

logger = logging.getLogger(__name__)


class TutorBrain:
    """
    Orquestador principal de AMY.
    Pipeline: Query -> RAG -> Prompt Builder -> Groq/Ollama -> Guardrails -> Response
    """

    async def think(self, student_query: str, chat_history: list[dict] = None, model_preference: str = "auto") -> dict:
        """Procesa una consulta del estudiante a través del pipeline RAG con conmutación por tokens."""
        rag_context_used = False
        model_switched = False
        switch_reason = None
        
        # Generar un hash simple del historial para usar como contexto en Redis
        history_context = ""
        if chat_history:
            history_context = str([msg["content"] for msg in chat_history])

        query_clean = student_query.strip().lower()
        greetings = ["hola", "buenos dias", "buenas tardes", "buenas noches", "saludos", "hola amy", "como estas", "que tal", "buen dia"]
        is_greeting = any(query_clean == g or query_clean.startswith(g + " ") or query_clean.startswith(g + ",") for g in greetings)

        try:
            # 1. Caché Redis (excepto saludos)
            if not is_greeting:
                cached_response = await redis_cache.get_cached_response(student_query, context=history_context)
                if cached_response is not None:
                    return cached_response

            # 2. Búsqueda Híbrida (RAG)
            context_fragments = await semantic_search(student_query)
            rag_context_used = len(context_fragments) > 0

            if context_fragments:
                context_fragments = sanitize_rag_context(context_fragments)

            # 3. Construcción del Prompt
            enriched_prompt = build_rag_prompt(student_query, context_fragments, chat_history=chat_history)

            ecuador = timezone(timedelta(hours=-5))
            fecha_actual = datetime.now(ecuador).strftime('%A %d de %B del %Y, %H:%M')
            
            if is_greeting:
                system_con_fecha = 'Eres AMY, la tutora virtual de Fundamentos de Bases de Datos de la UPEC. Responde al saludo del estudiante de forma cálida, humana, breve y fresca. FORMATO JSON OBLIGATORIO: {"analysis": "Saludo", "feedback": "Tu mensaje cordial de bienvenida", "topic": "Saludos"}'
            else:
                system_con_fecha = SYSTEM_PROMPT + f' La fecha y hora actual en Ecuador es: {fecha_actual}.'

            raw_response = None
            llm_source = "ollama-mistral"
            pref = (model_preference or "auto").lower()

            # Intentar según preferencia
            if pref == "groq":
                try:
                    logger.info("Solicitando respuesta a Groq (Llama 3.3)...")
                    raw_response = await groq_client.generate(prompt=enriched_prompt, system=system_con_fecha)
                    llm_source = "groq-llama3"
                except Exception as e:
                    logger.warning("Groq preferido falló (%s). Conmutando automáticamente a Ollama local...", e)
                    model_switched = True
                    switch_reason = "Tokens de Groq agotados o límite alcanzado. Se conmutó automáticamente a Ollama local (Mistral)."
                    try:
                        raw_response = await ollama_client.generate(prompt=enriched_prompt, system=system_con_fecha)
                        llm_source = "ollama-mistral"
                    except Exception as err_ollama:
                        logger.error("Fallo total en ambos proveedores: %s", err_ollama)
                        raise

            elif pref == "ollama":
                try:
                    logger.info("Solicitando respuesta a Ollama local (Mistral)...")
                    raw_response = await ollama_client.generate(prompt=enriched_prompt, system=system_con_fecha)
                    llm_source = "ollama-mistral"
                except Exception as e:
                    logger.warning("Ollama local preferido falló (%s). Conmutando a Groq API...", e)
                    model_switched = True
                    switch_reason = "Ollama local no disponible. Se conmutó automáticamente a Groq API (Llama 3.3)."
                    try:
                        raw_response = await groq_client.generate(prompt=enriched_prompt, system=system_con_fecha)
                        llm_source = "groq-llama3"
                    except Exception as err_groq:
                        logger.error("Fallo total en ambos proveedores: %s", err_groq)
                        raise

            else: # auto mode
                has_groq_key = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())
                if has_groq_key:
                    try:
                        logger.info("Modo Auto: Probando primero Groq API...")
                        raw_response = await groq_client.generate(prompt=enriched_prompt, system=system_con_fecha)
                        llm_source = "groq-llama3"
                    except Exception as e:
                        logger.warning("Modo Auto: Groq falló (%s). Conmutando automáticamente a Ollama local...", e)
                        model_switched = True
                        switch_reason = "Tokens de Groq o cuota agotada. Conmutado automáticamente a Ollama local."

                if not raw_response:
                    logger.info("Modo Auto: Generando respuesta con Ollama local (Mistral)...")
                    try:
                        raw_response = await ollama_client.generate(prompt=enriched_prompt, system=system_con_fecha)
                        llm_source = "ollama-mistral"
                    except Exception as e:
                        logger.error("Error definitivo en ambos proveedores LLM (Groq y Ollama): %s", e)
                        raise

            # 4. Guardrails (Validación)
            result = validate_response(raw_response)
            result["source"] = llm_source
            result["rag_context_used"] = rag_context_used
            result["model_switched"] = model_switched
            result["switch_reason"] = switch_reason

            result["rag_sources"] = [
                {
                    "id": f.get("id_fragmento"),
                    "categoria": f.get("categoria"),
                    "contenido": f.get("contenido", "")[:300],
                    "metadata": f.get("metadata", {}),
                    "similarity": round(f.get("similarity", 0.0), 4),
                    "rrf_score": round(f.get("rrf_score", 0.0), 4),
                }
                for f in context_fragments
            ] if rag_context_used else []

            # 5. Ejemplo interactivo — prioridad al diagrama dinámico del LLM
            topic = result.get("topic", "")
            llm_live_example = result.get("live_example")  # ya extraído por validate_response

            if llm_live_example:
                # El LLM generó un diagrama E-R dinámico — usarlo directamente
                logger.info("Diagrama E-R dinamico recibido del LLM (type=%s)", llm_live_example.get("type"))
            else:
                # Fallback: detección estática por palabras clave (ejemplos hardcodeados)
                static_example = detect_example(student_query, topic)
                if static_example:
                    result["live_example"] = static_example

            return result

        except Exception as e:
            logger.error("Error general en TutorBrain.think: %s", e)
            return {
                "analysis": "Error interno",
                "feedback": "Lo siento, ha ocurrido un inconveniente momentáneo con el servicio de IA. Por favor intenta de nuevo en unos segundos.",
                "topic": "Error",
                "source": "error",
                "rag_context_used": False,
                "rag_sources": [],
                "model_switched": model_switched,
                "switch_reason": switch_reason
            }


brain = TutorBrain()
