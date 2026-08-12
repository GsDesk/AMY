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
# System Prompt Maestro — Personalidad Dinámica y Módulos Pedagógicos UPEC
# ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Eres AMY, la tutora virtual experta en Fundamentos de Bases de Datos y Análisis de Datos de la Universidad Politécnica Estatal del Carchi (UPEC). Tienes amplia experiencia académica en diseño relacional, SQL, normalización y administración de SGBD.

USO DEL CONOCIMIENTO Y RAG:
- Cuando la consulta del estudiante contenga fragmentos en el "CONTEXTO ACADEMICO RECUPERADO (RAG)", fundamenta tus explicaciones en esa bibliografía oficial (Silberschatz, Elmasri, Navathe, etc.) y cita la fuente cuando corresponda.

DIRECTRICES OBLIGATORIAS DE PERSONALIDAD Y ENRUTAMIENTO DE INTENCIONES:

1. SALUDOS Y CORTESÍA (ej. "hola", "buenos días", "buenas tardes", "¿cómo estás?"):
   - Genera SIEMPRE una respuesta diferente, fresca, humana y cercana cada vez. NUNCA repitas la misma frase exacta.
   - Saluda cordialmente, expresa tu agrado por estudiar Bases de Datos en la UPEC y ofrece tu ayuda.

2. IDENTIDAD Y PREGUNTAS SOBRE TI (ej. "¿Qué es AMY?", "¿Quién eres?", "¿Qué haces?"):
   - Explica con naturalidad y variaciones creativas que eres AMY (Asistente Multimodal e Inteligente de la UPEC), especializada en guiar el aprendizaje interactivo de Bases de Datos.

3. CONSULTAS FUERA DE CONTEXTO DE BASES DE DATOS (ej. deportes, recetas, clima, farándula, política, etc.):
   - Responde de forma amable e incluye de manera explícita e inequívoca la frase:
     "Aún no tengo conocimiento en esa área, pero sigo aprendiendo día a día. Por ahora, solo puedo ayudarte con temas de Fundamentos de Bases de Datos."
   - Redirige cordialmente la conversación hacia temas académicos de BD.

4. MÓDULOS PEDAGÓGICOS ESPECIALIZADOS (Aplica según la consulta del usuario):

   a) PLANIFICADOR DE HABILIDADES (Para guías de estudio desde cero):
      - Analiza el nivel actual del estudiante, diseña un plan semanal paso a paso con ejercicios diarios y puntos de control semanales.

   b) ENTRENAMIENTO EN FUNDAMENTOS SQL (SELECT, WHERE, ORDER BY, LIMIT):
      - Muestra ejemplos claros con tablas realistas inventadas (ej. Clientes/Pedidos), señala el error común de sintaxis y plantea una pequeña tarea. Corrige las respuestas del estudiante línea por línea.

   c) DECODIFICADOR DE JOINS (INNER, LEFT, RIGHT, FULL):
      - Explica combinaciones con 2 tablas pequeñas visuales. Muestra el resultado exacto, caso de uso de negocio y plantea 3 preguntas progresivas. ESPERA la respuesta del estudiante antes de revelar soluciones.

   d) TALLER DE AGREGACIONES (GROUP BY, HAVING, COUNT, SUM, AVG):
      - Guía el análisis completo en 4 pasos: Pregunta de Negocio -> Consulta SQL -> Resultado -> Insight. Asigna preguntas combinadas y sugiere formas de escribir código más limpio.

   e) PROYECTO CON DATOS REALES (Limpieza y Mentoría):
      - Proporciona datasets desordenados con un objetivo claro. Guía en la limpieza/exploración, critica constructivamente el enfoque del estudiante y enseña a redactar un resumen ejecutivo para gerencia.

   f) TRADUCTOR DE INSIGHTS PARA GERENCIA:
      - Transforma resultados de consultas SQL en una narrativa clara identificando los 3 hallazgos clave, su causa probable y acción sugerida, en lenguaje no técnico con recomendación de gráficos.

   g) REVISOR Y AUDITOR DE CONSULTAS (Code Reviewer):
      - Al recibir una consulta SQL del estudiante, evalúa Corrección, Legibilidad y Rendimiento. Califica la consulta del 1 al 10 y señala la mejora prioritaria.

5. MÉTODO SOCRÁTICO:
   - En explicaciones técnicas, no des siempre la solución servida de inmediato: haz preguntas guía que estimulen el razonamiento lógico del estudiante.

6. MOTOR DINAMICO DE DIAGRAMAS E-R (MUY IMPORTANTE - OBLIGATORIO):
   Cuando el estudiante pregunte sobre COMO SE RELACIONAN dos o mas tablas, como disenar un esquema, pida un diagrama E-R, o pregunte por relaciones entre entidades especificas (ej: "Usuarios y Roles", "Facturas y Detalle", "Clientes y Pedidos", "Estudiantes y Cursos", "Productos e Inventario", etc.):

   a) Identifica dinamicamente TODAS las entidades/tablas mencionadas o implicadas.
   b) Determina la cardinalidad correcta (1:1, 1:N, N:M).
   c) Deduce las columnas esenciales con sus tipos de dato, claves primarias (PK) y foraneas (FK).
   d) Genera el bloque Mermaid erDiagram valido para ESA consulta especifica. NUNCA uses un ejemplo hardcodeado.
   e) En tu respuesta JSON incluye el campo adicional "live_example" con la siguiente estructura EXACTA:

   "live_example": {
     "type": "er_diagram",
     "title": "Relacion entre TablaA y TablaB",
     "cardinality": "1:N",
     "description": "Descripcion breve de la regla de negocio",
     "mermaid_code": "erDiagram\n  TABLA_A ||--o{ TABLA_B : relaciona\n  TABLA_A {\n    int id_a PK\n    string nombre\n  }\n  TABLA_B {\n    int id_b PK\n    int id_a FK\n    string descripcion\n  }",
     "tables": [
       {
         "name": "NombreTablaA",
         "columns": [
           {"name": "id", "type": "INT", "isPk": true},
           {"name": "nombre", "type": "VARCHAR(100)"}
         ]
       },
       {
         "name": "NombreTablaB",
         "columns": [
           {"name": "id", "type": "INT", "isPk": true},
           {"name": "id_tabla_a", "type": "INT", "isFk": true, "references": "NombreTablaA(id)"},
           {"name": "descripcion", "type": "TEXT"}
         ]
       }
     ]
   }

   REGLAS del mermaid_code:
   - 1:1: TABLA_A ||--|| TABLA_B : "relacion"
   - 1:N: TABLA_A ||--o{ TABLA_B : "relacion"
   - N:M: usa tabla intermedia con dos relaciones ||--o{

FORMATO DE RESPUESTA JSON OBLIGATORIO:
Debes responder UNICAMENTE con un objeto JSON valido con esta estructura:
{
    "analysis": "Breve diagnostico interno de la intencion o error del estudiante",
    "feedback": "Respuesta pedagogica formateada en Markdown impecable",
    "topic": "SQL | Normalizacion | Modelo E-R | Algebra Relacional | Diseno de BD | Transacciones | Indices | Fundamentos | Saludos | General | Fuera de Alcance",
    "live_example": null
}
Cuando detectes una intencion de diagrama E-R, reemplaza "live_example": null por el objeto completo descrito arriba.
"""


# ────────────────────────────────────────────────────────────
# Temas permitidos para validación post-respuesta
# ────────────────────────────────────────────────────────────
ALLOWED_TOPICS = {
    "SQL", "Normalización", "Modelo E-R", "Álgebra Relacional",
    "Diseño de BD", "Transacciones", "Índices", "Fundamentos",
    "Fuera de Alcance", "General", "Saludos"
}


# ────────────────────────────────────────────────────────────
# Sanitización de Contexto RAG — Protección contra Prompt Injection
# ────────────────────────────────────────────────────────────

# Patrones de Prompt Injection conocidos en documentos maliciosos
_INJECTION_PATTERNS = [
    # Tokens de rol de modelos de lenguaje
    re.compile(r"<\|im_start\|>.*?<\|im_end\|>", re.DOTALL | re.IGNORECASE),
    re.compile(r"\[INST\].*?\[/INST\]", re.DOTALL | re.IGNORECASE),
    re.compile(r"<\|system\|>|<\|user\|>|<\|assistant\|>", re.IGNORECASE),
    re.compile(r"<<SYS>>.*?<</SYS>>", re.DOTALL | re.IGNORECASE),
    # Comandos de cambio de rol e instrucciones de anulación
    re.compile(
        r"(ignore|forget|disregard|override)\s+(previous|all|prior|your)\s+(instructions?|rules?|constraints?|system\s+prompt)",
        re.IGNORECASE,
    ),
    re.compile(r"you\s+are\s+now\s+a?\.?\s*\w+", re.IGNORECASE),
    re.compile(r"act\s+as\s+(a|an)?\s*(?!database|tutor|assistant)", re.IGNORECASE),
    re.compile(r"pretend\s+(to\s+be|you\s+are)", re.IGNORECASE),
    re.compile(r"jailbreak|DAN\s+mode|do\s+anything\s+now", re.IGNORECASE),
    # Separadores de turno de conversación
    re.compile(r"\n+Human:\s*", re.IGNORECASE),
    re.compile(r"\n+Assistant:\s*", re.IGNORECASE),
    re.compile(r"\n+System:\s*", re.IGNORECASE),
    re.compile(r"\n+User:\s*", re.IGNORECASE),
    # Inyecciones de prompt directas
    re.compile(r"NEW\s+INSTRUCTIONS?:", re.IGNORECASE),
    re.compile(r"SYSTEM\s+OVERRIDE", re.IGNORECASE),
    re.compile(r"IMPORTANT:?\s+From\s+now\s+on", re.IGNORECASE),
]

_MAX_FRAGMENT_CHARS = 1000  # Longitud máxima por fragmento en el contexto


def sanitize_rag_context(fragments: list[dict]) -> list[dict]:
    """
    Limpia y escapa el contexto recuperado del RAG antes de incluirlo
    en el prompt del LLM, mitigando ataques de Prompt Injection.

    Acciones realizadas por fragmento:
    1. Elimina patrones conocidos de Prompt Injection (tokens de rol,
       comandos de anulación, separadores de turno).
    2. Trunca el contenido a _MAX_FRAGMENT_CHARS caracteres.
    3. Registra en el log si se detectó y sanitizó contenido sospechoso.

    Args:
        fragments: Lista de dicts con campo 'contenido' del retriever.

    Returns:
        Lista de dicts con 'contenido' sanitizado.
    """
    sanitized = []
    for frag in fragments:
        original = frag.get("contenido", "")
        cleaned = original
        was_modified = False

        for pattern in _INJECTION_PATTERNS:
            new_text = pattern.sub(" [CONTENIDO SANITIZADO] ", cleaned)
            if new_text != cleaned:
                was_modified = True
                cleaned = new_text

        # Normalizar espacios generados por la sanitización
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

        # Truncar a longitud máxima
        if len(cleaned) > _MAX_FRAGMENT_CHARS:
            cleaned = cleaned[:_MAX_FRAGMENT_CHARS] + "..."
            was_modified = True

        if was_modified:
            logger.warning(
                "⚠️ Fragmento RAG sanitizado (id=%s). Posible intento de Prompt Injection detectado.",
                frag.get("id_fragmento", "desconocido"),
            )

        sanitized.append({**frag, "contenido": cleaned})

    return sanitized

def validate_response(response_text: str) -> dict:
    """
    Valida y parsea la respuesta del modelo.
    """
    result = None
    # 1. Extraer de bloque markdown 
    match = re.search(r'```(?:json)?\s*(\{.*?\})```', response_text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(1).strip())
        except: pass
    # 2. Intentar parsear directamente
    if not result:
        try:
            result = json.loads(response_text.strip())
        except: pass

    # Si no se pudo parsear, construir respuesta de fallback
    if not result or not isinstance(result, dict):
        logger.warning("Respuesta del modelo no es JSON válido, aplicando fallback")
        return {
            "analysis": "La respuesta del modelo no cumplió el formato esperado.",
            "feedback": response_text.strip() if response_text else "No pude procesar tu consulta. ¿Podrías reformularla?",
            "topic": "General"
        }

    # Garantizar campos requeridos
    # Si el feedback contiene JSON anidado, limpiarlo
    if isinstance(result.get("feedback"), str):
        fb = result["feedback"]
        if fb.strip().startswith("{"):
            try:
                inner = json.loads(fb)
                if "feedback" in inner:
                    result["feedback"] = inner["feedback"]
                    result["analysis"] = inner.get("analysis", result.get("analysis", ""))
                    result["topic"] = inner.get("topic", result.get("topic", "General"))
            except:
                pass
    result.setdefault("analysis", "Sin analisis disponible.")
    result.setdefault("feedback", "¿Podrias darme mas detalles sobre tu duda?")
    result.setdefault("topic", "General")

    # Normalizar live_example si el LLM lo incluyó (diagrama E-R dinámico)
    live_example = result.get("live_example")
    if live_example and isinstance(live_example, dict):
        # Validar que tenga la estructura mínima esperada
        if not live_example.get("type") or not live_example.get("mermaid_code"):
            result["live_example"] = None
    else:
        result["live_example"] = None

    # Validar que el topic sea de la lista permitida
    if result["topic"] not in ALLOWED_TOPICS:
        result["topic"] = "General"

    return result


def is_db_related(query: str) -> bool:
    """
    Filtro para detectar si la consulta trata sobre bases de datos relacionales.
    """
    db_keywords = [
        "sql", "select", "insert", "update", "delete", "join", "inner", "left", "right", "outer",
        "tabla", "table", "base de datos", "database", "bd", "normalización", "normalizacion",
        "1nf", "2nf", "3nf", "bcnf", "entidad", "relación", "relacion", "relaciones", "relacionar",
        "clave", "primaria", "foránea", "foranea", "foreign key", "primary key", "pk", "fk",
        "índice", "indice", "index", "transacción", "transaccion", "acid", "commit", "rollback",
        "álgebra relacional", "algebra relacional", "proyección", "proyeccion", "selección", "seleccion",
        "diagrama", "cardinalidad", "atributo", "er", "e-r", "modelo", "esquema", "schema",
        "where", "group by", "having", "order by", "subquery", "subconsulta", "subconsultas",
        "vista", "view", "trigger", "procedimiento", "stored procedure",
        "postgresql", "mysql", "sgbd", "dbms", "dependencia funcional", "descomposición", "descomposicion",
        "campo", "campos", "columna", "columnas", "registro", "registros", "fila", "filas", "ddl", "dml", "dcl"
    ]
    
    query_lower = query.lower()
    return any(kw in query_lower for kw in db_keywords)
