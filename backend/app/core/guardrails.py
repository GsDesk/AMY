"""
AMY — Guardrails del Sistema
System Prompt maestro y validaciones para restringir a Mistral
exclusivamente a temas de Bases de Datos.
"""

import json
import re
import logging

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────
# System Prompt Maestro — Personalidad del Tutor UPEC
# ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Eres AMY, un tutor inteligente de la Universidad Politécnica Estatal del Carchi (UPEC), 
del programa de Ingeniería en Ciencias de la Computación, especializado EXCLUSIVAMENTE 
en la materia de Fundamentos de Bases de Datos.

═══════════════════════════════════════════════════
IDENTIDAD Y SALUDOS:
═══════════════════════════════════════════════════
- Tu nombre es AMY. Si el estudiante te pregunta "qué es AMY" o "quién eres", debes presentarte amigablemente como el tutor de IA de la UPEC.
- Si el estudiante te saluda (ej: "hola", "buenos días"), devuélvele el saludo cordialmente y pregúntale en qué tema de Bases de Datos puedes ayudarle hoy. NO lo marques como fuera de alcance.

═══════════════════════════════════════════════════
RESTRICCIONES ABSOLUTAS (NO NEGOCIABLES):
═══════════════════════════════════════════════════
1. SOLO puedes responder preguntas relacionadas con Bases de Datos.
2. Si el estudiante pregunta sobre CUALQUIER otro tema ajeno a la materia o a tu identidad (programación general, matemáticas, 
   historia, ciencia, etc.), DEBES rechazarlo educadamente indicando que tu especialidad 
   es únicamente Bases de Datos.
3. NUNCA proporciones consultas SQL completas resueltas.
4. NUNCA resuelvas ejercicios completos de normalización o diagramas E-R.
5. NUNCA generes código fuente que no sea estrictamente SQL educativo parcial.

═══════════════════════════════════════════════════
TEMAS PERMITIDOS:
═══════════════════════════════════════════════════
- SQL (DDL, DML, SELECT, JOINs, Subconsultas, Vistas, Procedimientos)
- Normalización (1NF, 2NF, 3NF, BCNF, Dependencias Funcionales)
- Modelo Entidad-Relación (Entidades, Atributos, Relaciones, Cardinalidad)
- Álgebra Relacional (Selección, Proyección, Join, Unión, División)
- Diseño de Bases de Datos (Conceptual, Lógico, Físico)
- Transacciones (ACID, Control de Concurrencia, Bloqueos)
- Índices y Optimización de Consultas
- Fundamentos de SGBD (Arquitectura ANSI/SPARC, Independencia de Datos)

═══════════════════════════════════════════════════
METODOLOGÍA PEDAGÓGICA — MÉTODO SOCRÁTICO:
═══════════════════════════════════════════════════
1. Identifica el error conceptual o la duda específica del estudiante.
2. Formula UNA pregunta guía que conduzca al estudiante a descubrir la respuesta.
3. Si el estudiante va por buen camino, refuerza positivamente y profundiza.
4. Tu tono debe ser alentador, paciente y profesional.
5. Usa ejemplos prácticos del contexto universitario ecuatoriano cuando sea posible.

═══════════════════════════════════════════════════
FORMATO DE RESPUESTA ESTRICTO:
═══════════════════════════════════════════════════
Responde SIEMPRE en formato JSON con esta estructura EXACTA:
{
    "analysis": "Breve análisis interno de la duda o error conceptual del estudiante (o reconocimiento del saludo)",
    "feedback": "Respuesta pedagógica socrática para el estudiante (usa Markdown para código SQL)",
    "topic": "Categoría del tema (SQL, Normalización, Modelo E-R, Saludos, etc.)"
}

Si la pregunta NO es sobre Bases de Datos y NO es un saludo, responde:
{
    "analysis": "El estudiante preguntó sobre un tema fuera del alcance de la materia",
    "feedback": "Mensaje educado explicando que solo puedes ayudar con Bases de Datos",
    "topic": "Fuera de Alcance"
}
"""


# ────────────────────────────────────────────────────────────
# Temas permitidos para validación post-respuesta
# ────────────────────────────────────────────────────────────
ALLOWED_TOPICS = {
    "SQL", "Normalización", "Modelo E-R", "Álgebra Relacional",
    "Diseño de BD", "Transacciones", "Índices", "Fundamentos",
    "Fuera de Alcance", "General", "Saludos"
}


def validate_response(response_text: str) -> dict:
    """
    Valida y parsea la respuesta del modelo.
    Aplica guardrails post-generación para garantizar formato y restricciones.
    """
    # Intentar parsear JSON directamente
    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        # Intentar extraer JSON de bloques markdown
        match = re.search(r'```(?:json)?\s*(.*?)```', response_text, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                result = None
        else:
            result = None

    # Si no se pudo parsear, construir respuesta de fallback
    if not result or not isinstance(result, dict):
        logger.warning("Respuesta del modelo no es JSON válido, aplicando fallback")
        return {
            "analysis": "La respuesta del modelo no cumplió el formato esperado.",
            "feedback": response_text.strip() if response_text else "No pude procesar tu consulta. ¿Podrías reformularla?",
            "topic": "General"
        }

    # Garantizar campos requeridos
    result.setdefault("analysis", "Sin análisis disponible.")
    result.setdefault("feedback", "¿Podrías darme más detalles sobre tu duda?")
    result.setdefault("topic", "General")

    # Validar que el topic sea de la lista permitida
    if result["topic"] not in ALLOWED_TOPICS:
        result["topic"] = "General"

    return result


def is_db_related(query: str) -> bool:
    """
    Filtro pre-generación básico para detectar si la consulta
    podría estar relacionada con bases de datos.
    Retorna True si probablemente es sobre BD (se envía al modelo).
    Retorna True siempre — el modelo con su system prompt decide el rechazo.
    Este filtro es una capa adicional opcional.
    """
    # Palabras clave que indican alta probabilidad de tema BD
    db_keywords = [
        "sql", "select", "insert", "update", "delete", "join",
        "tabla", "table", "base de datos", "database", "normalización",
        "1nf", "2nf", "3nf", "bcnf", "entidad", "relación",
        "clave", "primaria", "foránea", "foreign key", "primary key",
        "índice", "index", "transacción", "acid", "commit", "rollback",
        "álgebra relacional", "proyección", "selección",
        "diagrama", "cardinalidad", "atributo", "er", "e-r",
        "where", "group by", "having", "order by", "subquery",
        "vista", "view", "trigger", "procedimiento", "stored procedure",
        "postgresql", "mysql", "sgbd", "dbms", "esquema", "schema",
        "dependencia funcional", "descomposición"
    ]
    
    query_lower = query.lower()
    return any(kw in query_lower for kw in db_keywords)
