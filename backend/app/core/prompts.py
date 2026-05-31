"""
Tutor IA UPEC — Templates de Prompts
Construcción de prompts para el pipeline RAG.
"""


def build_rag_prompt(student_query: str, context_fragments: list[dict], chat_history: list[dict] = None) -> str:
    """
    Construye el prompt enriquecido con contexto RAG y el historial de la conversación.
    Inyecta los fragmentos relevantes recuperados de pgvector
    como contexto para que Mistral genere una respuesta informada.
    """
    history_block = ""
    if chat_history:
        history_lines = []
        for msg in chat_history:
            role = "Tutor" if msg["role"] == "assistant" else "Estudiante"
            history_lines.append(f"{role}: {msg['content']}")
        history_str = "\n".join(history_lines)
        history_block = f"═══ HISTORIAL DE LA CONVERSACION ═══\n{history_str}\n═══ FIN DEL HISTORIAL ═══\n\n"

    if not context_fragments:
        return f"""{history_block}Consulta del estudiante: {student_query}

NOTA: No se encontro contexto relevante en la base de conocimiento.
Responde basandote en tu conocimiento general sobre Bases de Datos.
Recuerda aplicar el metodo socratico y responder en formato JSON."""

    # Construir el bloque de contexto
    context_block = "\n\n".join([
        f"[Fragmento {i+1} — {frag.get('categoria', 'General')}]\n"
        f"{frag.get('contenido', '')}\n"
        f"Fuente: {frag.get('metadata', {})}"
        for i, frag in enumerate(context_fragments)
    ])

    return f"""═══ CONTEXTO ACADEMICO RECUPERADO (RAG) ═══
{context_block}
═══ FIN DEL CONTEXTO ═══

{history_block}Consulta del estudiante: {student_query}

INSTRUCCIONES:
- Usa el contexto academico anterior para fundamentar tu respuesta.
- Toma en cuenta el historial de la conversacion si el estudiante hace referencia a preguntas anteriores.
- Cita la fuente bibliografica cuando sea relevante.
- Aplica el metodo socratico: guia, no resuelvas.
- Responde en formato JSON estricto."""


def build_embedding_prompt(text: str) -> str:
    """
    Prepara el texto para la generación de embeddings.
    Limpia y normaliza el texto antes de enviarlo a Ollama.
    """
    # Limpiar espacios excesivos y saltos de línea
    cleaned = " ".join(text.split())
    return cleaned
