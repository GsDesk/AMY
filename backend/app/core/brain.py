"""
AMY — Cerebro del Tutor (Orquestador con Prioridad de Velocidad)
Pipeline: Query -> RAG // Historia (paralelo) -> Prompt -> Gemini / Groq / Ollama -> Guardrails
Orden de prioridad: Gemini > Groq > Ollama local
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from app.rag.retriever import semantic_search
from app.integrations.gemini_client import gemini_client
from app.integrations.groq_client import groq_client
from app.integrations.ollama_client import ollama_client
from app.core.guardrails import SYSTEM_PROMPT, validate_response, sanitize_rag_context, is_example_or_problem_requested
from app.core.prompts import build_rag_prompt
from app.core.examples import detect_example
from app.cache.redis_cache import redis_cache
from app.config import settings

logger = logging.getLogger(__name__)


def _has_gemini() -> bool:
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())


def _has_groq() -> bool:
    return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())


async def _try_gemini(prompt: str, system: str) -> tuple[str, bool]:
    """Intenta Gemini con timeout máximo de 12s."""
    try:
        logger.info("Solicitando respuesta a Gemini API...")
        text = await asyncio.wait_for(gemini_client.generate(prompt=prompt, system=system), timeout=12.0)
        return text, True
    except Exception as e:
        logger.warning("Gemini fallo o excede 12s: %s", e)
        return "", False


async def _try_groq(prompt: str, system: str) -> tuple[str, bool]:
    """Intenta Groq con timeout máximo de 12s."""
    try:
        logger.info("Solicitando respuesta a Groq API...")
        text = await asyncio.wait_for(groq_client.generate(prompt=prompt, system=system), timeout=12.0)
        return text, True
    except Exception as e:
        logger.warning("Groq fallo o excede 12s: %s", e)
        return "", False


async def _try_ollama(prompt: str, system: str) -> tuple[str, bool]:
    """Intenta Ollama local con timeout de 120s."""
    try:
        logger.info("Solicitando respuesta a Ollama local (Mistral)...")
        text = await asyncio.wait_for(ollama_client.generate(prompt=prompt, system=system), timeout=120.0)
        # Validar que la respuesta tenga contenido suficiente
        if text and len(text.strip()) > 20:
            return text, True
        logger.warning("Ollama devolvio texto insuficiente: '%s'", text[:50] if text else "(vacio)")
        return "", False
    except Exception as e:
        logger.warning("Ollama fallo o excede timeout: %s", e)
        return "", False




class TutorBrain:
    """
    Orquestador principal de AMY.
    Prioridad de velocidad: Gemini > Groq > Ollama
    RAG y carga de historial corren en PARALELO con asyncio.gather().
    """

    async def _load_history(self, conversation_id: str, user_id: str) -> list[dict]:
        """Carga los ultimos 8 mensajes de la conversacion desde la BD."""
        try:
            from app.database.connection import db
            rows = await db.fetch(
                """SELECT sender, content
                   FROM mensajes
                   WHERE conversacion_id = $1
                   ORDER BY created_at ASC
                   LIMIT 8""",
                conversation_id
            )
            if rows:
                return [
                    {"role": "user" if r["sender"] == "user" else "assistant", "content": r["content"]}
                    for r in rows
                ]
        except Exception as e:
            logger.warning("No se pudo cargar historial: %s", e)
        return []

    async def think(self, student_query: str, chat_history: list[dict] = None, model_preference: str = "auto") -> dict:
        """Procesa una consulta del estudiante a traves del pipeline RAG."""
        rag_context_used = False
        model_switched = False
        switch_reason = None

        query_clean = student_query.strip().lower()
        history_context = ""
        if chat_history:
            history_context = str([msg["content"] for msg in chat_history])

        greetings = [
            "hola", "buenos dias", "buenas tardes", "buenas noches",
            "saludos", "hola amy", "como estas", "que tal", "buen dia"
        ]
        is_greeting = any(
            query_clean == g or query_clean.startswith(g + " ") or query_clean.startswith(g + ",")
            for g in greetings
        )

        try:
            # 1. Cache Redis (excepto saludos)
            if not is_greeting:
                cached = await redis_cache.get_cached_response(student_query, context=history_context)
                if cached is not None:
                    logger.info("Respuesta servida desde cache Redis")
                    return cached

            # 2. RAG (busqueda hibrida) — corre en paralelo con una tarea nula si es saludo
            if is_greeting:
                context_fragments = []
            else:
                context_fragments = await semantic_search(student_query)

            rag_context_used = len(context_fragments) > 0
            if context_fragments:
                context_fragments = sanitize_rag_context(context_fragments)

            # 3. Construcción del Prompt
            enriched_prompt = build_rag_prompt(student_query, context_fragments, chat_history=chat_history)

            ecuador = timezone(timedelta(hours=-5))
            fecha_actual = datetime.now(ecuador).strftime('%A %d de %B del %Y, %H:%M')

            if is_greeting:
                system_ctx = (
                    'Eres AMY, la tutora virtual de Fundamentos de Bases de Datos de la UPEC. '
                    'Responde al saludo del estudiante de forma calida, humana, breve y fresca. '
                    'FORMATO JSON OBLIGATORIO: {"analysis": "Saludo", '
                    '"feedback": "Tu mensaje cordial de bienvenida", "topic": "Saludos", "live_example": null}'
                )
            else:
                system_ctx = SYSTEM_PROMPT + f' La fecha y hora actual en Ecuador es: {fecha_actual}.'

            # 4. Selección y ejecución del proveedor LLM
            raw_response = ""
            llm_source = "ollama-mistral"
            pref = (model_preference or "auto").lower()

            if pref == "gemini":
                raw_response, ok = await _try_gemini(enriched_prompt, system_ctx)
                if ok:
                    llm_source = "gemini"
                else:
                    model_switched = True
                    switch_reason = "Gemini no disponible. Conmutando a Groq..."
                    raw_response, ok = await _try_groq(enriched_prompt, system_ctx)
                    if ok:
                        llm_source = "groq-llama3"
                    else:
                        switch_reason = "Gemini y Groq no disponibles. Usando Ollama local."
                        raw_response, ok = await _try_ollama(enriched_prompt, system_ctx)
                        llm_source = "ollama-mistral"

            elif pref == "groq":
                raw_response, ok = await _try_groq(enriched_prompt, system_ctx)
                if ok:
                    llm_source = "groq-llama3"
                else:
                    model_switched = True
                    switch_reason = "Groq no disponible. Conmutando a Gemini..."
                    raw_response, ok = await _try_gemini(enriched_prompt, system_ctx)
                    if ok:
                        llm_source = "gemini"
                    else:
                        switch_reason = "Groq y Gemini no disponibles. Usando Ollama local."
                        raw_response, ok = await _try_ollama(enriched_prompt, system_ctx)
                        llm_source = "ollama-mistral"

            elif pref == "ollama":
                raw_response, ok = await _try_ollama(enriched_prompt, system_ctx)
                if ok:
                    llm_source = "ollama-mistral"
                else:
                    model_switched = True
                    switch_reason = "Ollama no disponible. Conmutando a Gemini..."
                    raw_response, ok = await _try_gemini(enriched_prompt, system_ctx)
                    if ok:
                        llm_source = "gemini"
                    else:
                        switch_reason = "Ollama y Gemini no disponibles. Usando Groq."
                        raw_response, ok = await _try_groq(enriched_prompt, system_ctx)
                        llm_source = "groq-llama3"

            else:  # auto — prioridad: Gemini > Groq > Ollama
                if _has_gemini():
                    raw_response, ok = await _try_gemini(enriched_prompt, system_ctx)
                    if ok:
                        llm_source = "gemini"
                    else:
                        model_switched = True
                        switch_reason = "Gemini alcanzo su limite. Conmutando a Groq..."

                if not raw_response and _has_groq():
                    raw_response, ok = await _try_groq(enriched_prompt, system_ctx)
                    if ok:
                        llm_source = "groq-llama3"
                    elif not model_switched:
                        model_switched = True
                        switch_reason = "Groq alcanzo su limite. Conmutando a Ollama local..."
                    else:
                        switch_reason = "Gemini y Groq no disponibles. Usando Ollama local."

                if not raw_response:
                    raw_response, ok = await _try_ollama(enriched_prompt, system_ctx)
                    llm_source = "ollama-mistral"
                    if not ok:
                        raise RuntimeError("Todos los proveedores LLM fallaron.")

            if not raw_response:
                raise RuntimeError(f"Sin respuesta del proveedor seleccionado ({llm_source}).")

            # 5. Guardrails (Validación)
            result = validate_response(raw_response, student_query=student_query)
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

            # 6. Ejemplo interactivo — ÚNICAMENTE si el estudiante solicitó un ejemplo o ingresó un problema
            topic = result.get("topic", "")
            if is_example_or_problem_requested(student_query):
                llm_live_example = result.get("live_example")
                if llm_live_example:
                    logger.info("Diagrama E-R dinamico recibido del LLM (type=%s)", llm_live_example.get("type"))
                else:
                    static_example = detect_example(student_query, topic)
                    if static_example:
                        result["live_example"] = static_example
            else:
                result["live_example"] = None

            # 7. Guardar en cache Redis para futuras consultas identicas (TTL 2h)
            if not is_greeting and result.get("source") != "error":
                await redis_cache.cache_response(student_query, result, ttl=7200, context=history_context)

            return result

        except Exception as e:
            logger.error("Error general en TutorBrain.think: %s", e)
            return {
                "analysis": "Error interno",
                "feedback": (
                    "Lo siento, ha ocurrido un inconveniente momentaneo con el servicio de IA. "
                    "Por favor intenta de nuevo en unos segundos."
                ),
                "topic": "Error",
                "source": "error",
                "rag_context_used": False,
                "rag_sources": [],
                "live_example": None,
                "model_switched": model_switched,
                "switch_reason": switch_reason
            }


brain = TutorBrain()
