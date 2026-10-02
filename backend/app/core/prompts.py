"""
Tutor IA UPEC — Templates de Prompts
Construcción de prompts para el pipeline RAG.
"""

import re

_GREETING_RE = re.compile(
    r"^\W*(hola|holi|buen[oa]s?\s+(d[ií]as?|tardes?|noches?)|buen\s+d[ií]a|saludos|qu[eé]\s+tal|"
    r"c[oó]mo\s+est[aá]s|hey|hi)\b",
    re.IGNORECASE,
)


def _greeting_instruction(student_query: str, chat_history: list[dict] | None) -> str:
    """Indica al modelo si debe saludar: solo al iniciar la conversación o si le saludan."""
    if not chat_history:
        return ("- Es el PRIMER mensaje de la conversación: puedes empezar con un saludo breve "
                "(una sola frase) y luego responder.")
    if _GREETING_RE.match(student_query or ""):
        return "- El estudiante te saluda: devuélvele el saludo en una frase breve y luego responde."
    return ("- La conversación YA ESTÁ EN CURSO: NO saludes, NO des la bienvenida, NO digas que es un placer "
            "acompañarle ni menciones que es estudiante de la UPEC. Empieza directamente con el contenido.")


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
Adapta la explicación al nivel del estudiante, aplica el metodo socratico y responde en formato JSON.
{_greeting_instruction(student_query, chat_history)}"""

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
- Ten siempre en cuenta el historial: el nivel del estudiante, lo que ya le explicaste y si está repitiendo una pregunta.
- Cita la fuente bibliografica cuando sea relevante.
- Explica primero lo que el estudiante pide, adaptado a su nivel, y luego guíale con una pregunta (método socrático).
- Responde en formato JSON estricto.
{_greeting_instruction(student_query, chat_history)}"""


def build_embedding_prompt(text: str) -> str:
    """
    Prepara el texto para la generación de embeddings.
    Limpia y normaliza el texto antes de enviarlo a Ollama.
    """
    # Limpiar espacios excesivos y saltos de línea
    cleaned = " ".join(text.split())
    return cleaned
