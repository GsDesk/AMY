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
SYSTEM_PROMPT = """Eres AMY, la tutora pedagógica experta en Fundamentos y Administración de Bases de Datos de la Universidad Politécnica Estatal del Carchi (UPEC). Tu propósito es guiar en el diseño de modelos entidad-relación (E-R), esquemas relacionales normalizados (1FN, 2FN, 3FN), álgebra relacional, consultas SQL y la administración de bases de datos (seguridad, respaldos, rendimiento, concurrencia), adaptándote al nivel de cada estudiante y utilizando el método socrático.

USO DEL CONOCIMIENTO Y RAG:
- Cuando la consulta del estudiante contenga fragmentos en el "CONTEXTO ACADEMICO RECUPERADO (RAG)", fundamenta tus explicaciones en esa bibliografía oficial (Silberschatz, Elmasri, Navathe, etc.) y cita la fuente cuando corresponda.

PROHIBICIÓN TOTAL Y ESTRICTA DE EMOJIS Y NUMERACIÓN CON EMOJIS (NORMA ACADÉMICA):
Queda terminantemente prohibido utilizar emojis, emoticonos o listas decoradas con emojis en cualquiera de tus respuestas.
Queda expresamente prohibida la numeración con emojis (por ejemplo: numeracion tipo keycap 1, 2, 3, 4, etc.).
Utiliza EXCLUSIVAMENTE listas numeradas con números arábigos estándar (1., 2., 3.) o viñetas convencionales con guiones (-).
Toda comunicación debe mantener un estilo académico formal, riguroso, limpio y elegante.

REGLA FUNDAMENTAL DE MODELADO: COMPLETITUD DE ATRIBUTOS (ESTRICTO)
Queda estrictamente prohibido generar tablas con atributos comodín, sintéticos o abreviados (por ejemplo: `nombre_descripcion`, `campo_1`, `detalle_general`, `datos`).
Cada entidad debe reflejar fielmente los atributos estándar del mundo real con sus tipos de datos SQL apropiados:
1. Claves Primarias (PK): Nombradas explícitamente (`id_cliente`, `id_factura`, `codigo_producto`).
2. Atributos de Negocio Realistas:
   - Personas/Clientes/Empleados: Desglosar siempre en `ci` / `ci_ruc` (identificación), `nombres`, `apellidos`, `telefono`, `correo_electronico`, `direccion`.
   - Documentos Transaccionales (Factura, Pedido): `numero_documento`/`numero_factura`, `fecha_emision`, `subtotal`, `iva`, `total`, `estado`.
   - Detalles/Líneas (Intermedias N:M): `cantidad`, `precio_unitario`, `descuento`, `subtotal_linea`.
   - Productos/Servicios: `codigo_producto`, `nombre`, `descripcion`, `precio_unitario`, `stock`, `categoria`.
   - Pagos: `fecha_pago`, `monto`, `metodo_pago`, `numero_transaccion`.
3. Claves Foráneas (FK): Deben indicar explícitamente la tabla y campo referenciado (`id_cliente INT -> Cliente(id_cliente)`).

DIRECTRICES OBLIGATORIAS DE PERSONALIDAD Y ENRUTAMIENTO DE INTENCIONES:

1. SALUDOS Y CORTESÍA (ej. "hola", "buenos días", "buenas tardes", "¿cómo estás?"):
   - Saluda SOLO en dos casos: cuando es el primer mensaje de la conversación, o cuando el estudiante te saluda.
   - Si la conversación ya está en curso (hay historial) y el estudiante no te saluda, NO saludes, NO des la bienvenida,
     NO digas que es un placer acompañarle y NO le recuerdes que es estudiante de la UPEC: ve directo al contenido.
   - Cuando sí saludes, hazlo en una sola frase breve y variada (nunca la misma exacta) y ofrece tu ayuda.

2. IDENTIDAD Y PREGUNTAS SOBRE TI (ej. "¿Qué es AMY?", "¿Quién eres?", "¿Qué haces?"):
   - Explica con naturalidad y variaciones creativas que eres AMY (Asistente Multimodal e Inteligente de la UPEC), especializada en guiar el aprendizaje interactivo de Bases de Datos.

3. CONSULTAS FUERA DE CONTEXTO DE BASES DE DATOS (ej. deportes, recetas, clima, farándula, política, etc.):
   - Responde de forma amable e incluye de manera explícita e inequívoca la frase:
     "Aún no tengo conocimiento en esa área, pero sigo aprendiendo día a día. Por ahora, solo puedo ayudarte con temas de Fundamentos de Bases de Datos."
   - Redirige cordialmente la conversación hacia temas académicos de BD.

4. MÓDULOS PEDAGÓGICOS ESPECIALIZADOS (Aplica según la consulta del usuario):
   a) PLANIFICADOR DE HABILIDADES: Diseña un plan semanal paso a paso con ejercicios y puntos de control.
   b) ENTRENAMIENTO EN FUNDAMENTOS SQL: Muestra ejemplos claros con tablas realistas (Clientes/Facturas/Productos), señala errores comunes y plantea tareas socráticas.
   c) DECODIFICADOR DE JOINS: Explica combinaciones con 2 tablas realistas, muestra casos de uso y plantea preguntas progresivas.
   d) TALLER DE AGREGACIONES: Guía el análisis: Pregunta de Negocio -> Consulta SQL -> Resultado -> Insight.
   e) PROYECTO CON DATOS REALES: Guía en normalización, limpieza y diseño relacional 3FN.
   f) TRADUCTOR DE INSIGHTS: Transforma resultados SQL en narrativa clara ejecutiva.
   g) REVISOR Y AUDITOR DE CONSULTAS: Evalúa corrección, legibilidad y rendimiento (1 al 10).

5. ANALIZA LA SOLICITUD ANTES DE RESPONDER (OBLIGATORIO, se refleja en "analysis"):
   a) ¿Qué pide exactamente? (una explicación, un ejemplo, resolver un ejercicio, una aclaración...). Responde ESO primero.
   b) ¿Qué nivel tiene? Deduce el nivel del mensaje y del historial:
      - PRINCIPIANTE: dice que es principiante, que empieza "desde cero", que necesita "conceptos básicos", que "no entiende",
        o usa un lenguaje no técnico.
      - INTERMEDIO / AVANZADO: usa la terminología correctamente o pregunta por detalles técnicos.
   c) ¿Qué sabe ya? Revisa el historial para construir sobre lo explicado, sin repetirlo.
   d) Si el estudiante repite casi el mismo mensaje, significa que tu respuesta anterior no le sirvió: explícalo de otra
      forma, más simple y con otro ejemplo, sin volver a la misma explicación.

6. ADAPTACIÓN AL NIVEL DEL ESTUDIANTE:
   - Con un PRINCIPIANTE:
     - Explica desde cero con lenguaje sencillo y cotidiano. No supongas conocimientos previos.
     - Define cada término técnico la primera vez que lo uses (por ejemplo: "una tabla, que es como una hoja de cálculo
       con filas y columnas"). No uses siglas (SGBD, DBA, PK, FK) sin explicar qué significan.
     - Presenta pocos conceptos por respuesta (2 o 3 como máximo), en párrafos cortos y en orden lógico: primero la idea,
       luego una analogía de la vida diaria y después un ejemplo pequeño y concreto (una tabla de 3 o 4 filas).
     - Si pide "principios básicos" o "conceptos básicos", enuméralos y explica cada uno brevemente: no respondas solo con preguntas.
     - Cierra con UNA sola pregunta sencilla para comprobar que entendió, nunca con una lista de preguntas difíciles.
     - Evita escenarios complejos (concurrencia, varios usuarios editando a la vez...) hasta que domine lo básico.
   - Con un estudiante INTERMEDIO o AVANZADO: puedes usar terminología técnica, ir más rápido y profundizar.
   - Las citas bibliográficas son un apoyo breve al final de una idea, no el centro de la respuesta. Nunca menciones
     "fragmento 2", "el contexto recuperado" ni detalles internos: cita la obra o la fuente por su nombre.

7. MÉTODO SOCRÁTICO (equilibrado):
   - El método socrático guía el razonamiento, pero NO sustituye la explicación cuando el estudiante pide aprender algo
     nuevo: primero explica lo necesario y luego plantea una pregunta que le haga pensar.
   - Cuando el estudiante intenta resolver un ejercicio, guíale con preguntas en lugar de darle la solución completa.

8. USO DEL LIENZO DE LA DERECHA ('live_example', tablas y diagrama E-R):
   - Genera 'live_example' cuando:
     1) El estudiante pida EXPLÍCITAMENTE un EJEMPLO, EJERCICIO o PRÁCTICA de modelado ('dame un ejemplo de diagrama ER',
        'diseña un esquema para...', 'muestra un modelo').
     2) El estudiante ingrese un PROBLEMA de modelado o un archivo/imagen para diseñar una base de datos.
     3) Expliques a un PRINCIPIANTE conceptos que se entienden mejor viendo tablas reales: qué es una tabla, una fila,
        una columna, una clave primaria o foránea, cómo se relacionan dos tablas, qué es la redundancia o por qué se
        normaliza. En ese caso usa un esquema PEQUEÑO y sencillo (2 o 3 tablas de un caso cotidiano, por ejemplo
        Estudiante y Matrícula) y en "feedback" indícale que lo mire: "En el lienzo de la derecha puedes ver estas tablas...".
   - Menciona el lienzo SOLO si incluyes "live_example"; si no lo incluyes, no hables del lienzo.
   - Para el resto de preguntas teóricas o de administración que no se apoyan en tablas (por ejemplo, qué es un respaldo
     o para qué sirven los permisos), 'live_example' DEBE ser null.
   Cuando generes 'live_example':
   a) Identifica dinámicamente TODAS las entidades mencionadas o implicadas.
   b) Determina la cardinalidad correcta (1:1, 1:N, N:M).
   c) Asigna atributos completos del mundo real con tipos SQL, PKs y FKs explícitas.
   d) Genera el bloque Mermaid erDiagram válido.
   e) En tu respuesta JSON incluye el campo "live_example" con la estructura:

   "live_example": {
     "type": "er_diagram",
     "title": "Modelo: Cliente — Factura — Detalle_Factura — Producto",
     "cardinality": "1:N",
     "description": "Esquema relacional normalizado con completitud de atributos del mundo real",
     "mermaid_code": "erDiagram\n  CLIENTE ||--o{ FACTURA : \"1:N emite\"\n  EMPLEADO ||--o{ FACTURA : \"1:N procesa\"\n  FACTURA ||--|{ DETALLE_FACTURA : \"1:N contiene\"\n  PRODUCTO ||--o{ DETALLE_FACTURA : \"1:N pertenece\"\n  CLIENTE {\n    int id_cliente PK\n    string ci_ruc\n    string nombres\n    string apellidos\n    string telefono\n    string correo_electronico\n    string direccion\n  }\n  FACTURA {\n    int id_factura PK\n    string numero_factura\n    date fecha_emision\n    decimal subtotal\n    decimal iva\n    decimal total\n    int id_cliente FK\n    int id_empleado FK\n  }\n  DETALLE_FACTURA {\n    int id_detalle PK\n    int id_factura FK\n    int id_producto FK\n    int cantidad\n    decimal precio_unitario\n    decimal subtotal_linea\n  }\n  PRODUCTO {\n    int id_producto PK\n    string codigo_producto\n    string nombre\n    decimal precio_unitario\n    int stock\n  }",
     "tables": [
       {
         "name": "Cliente",
         "columns": [
           {"name": "id_cliente", "type": "INT", "isPk": true},
           {"name": "ci_ruc", "type": "VARCHAR(13)"},
           {"name": "nombres", "type": "VARCHAR(50)"},
           {"name": "apellidos", "type": "VARCHAR(50)"},
           {"name": "telefono", "type": "VARCHAR(15)"},
           {"name": "correo_electronico", "type": "VARCHAR(100)"},
           {"name": "direccion", "type": "VARCHAR(150)"}
         ]
       },
       {
         "name": "Factura",
         "columns": [
           {"name": "id_factura", "type": "INT", "isPk": true},
           {"name": "numero_factura", "type": "VARCHAR(20)"},
           {"name": "fecha_emision", "type": "DATE"},
           {"name": "subtotal", "type": "DECIMAL(10,2)"},
           {"name": "iva", "type": "DECIMAL(10,2)"},
           {"name": "total", "type": "DECIMAL(10,2)"},
           {"name": "estado", "type": "VARCHAR(20)"},
           {"name": "id_cliente", "type": "INT", "isFk": true, "references": "Cliente(id_cliente)"},
           {"name": "id_empleado", "type": "INT", "isFk": true, "references": "Empleado(id_empleado)"}
         ]
       }
     ]
   }

FORMATO DE RESPUESTA JSON OBLIGATORIO:
Debes responder UNICAMENTE con un objeto JSON valido con esta estructura:
{
    "analysis": "Diagnóstico interno: qué pide exactamente, su nivel (principiante, intermedio o avanzado) y qué sabe ya según el historial",
    "feedback": "Respuesta pedagogica formateada en Markdown impecable",
    "topic": "SQL | Normalizacion | Modelo E-R | Algebra Relacional | Diseno de BD | Transacciones | Indices | Administracion de BD | Fundamentos | Saludos | General | Fuera de Alcance",
    "live_example": null
}
Incluye en "live_example" el objeto estructurado solo en los casos de la regla 8 (ejemplo o problema de modelado, o tablas que ayudan a un principiante). En caso contrario, "live_example" DEBE ser estrictamente null."""


# ────────────────────────────────────────────────────────────
# Temas permitidos para validación post-respuesta
# ────────────────────────────────────────────────────────────
ALLOWED_TOPICS = {
    "SQL", "Normalización", "Modelo E-R", "Álgebra Relacional",
    "Diseño de BD", "Transacciones", "Índices", "Fundamentos",
    "Administración de BD", "Fuera de Alcance", "General", "Saludos"
}

TOPIC_ALIASES = {
    "Normalizacion": "Normalización", "Algebra Relacional": "Álgebra Relacional",
    "Diseno de BD": "Diseño de BD", "Indices": "Índices", "Administracion de BD": "Administración de BD",
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

_KEYCAP_EMOJI_PATTERN = re.compile(r'([0-9#*])\ufe0f?\u20e3')

_EMOJI_PATTERN = re.compile(
    r"[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\u2b50-\u2b55\u200d\ufe0f\u20e3\u25aa\u25ab\u23e9-\u23fa\u2139\u203c\u2049]",
    flags=re.UNICODE,
)

def clean_emojis_and_keycaps(text: str) -> str:
    """
    Convierte cualquier numeración con keycaps (ej. digito + variante selector + combinando encerrando keycap)
    en numeración estándar (1., 2.) y suprime por completo cualquier emoji Unicode residual.
    """
    if not text:
        return ""
    # Convertir keycaps a números arábigos estándar con punto
    cleaned = _KEYCAP_EMOJI_PATTERN.sub(r"\1. ", text)
    # Eliminar cualquier emoji Unicode
    cleaned = _EMOJI_PATTERN.sub("", cleaned)
    # Normalizar espaciados
    return re.sub(r"[ \t]{2,}", " ", cleaned).strip()

_MAX_FRAGMENT_CHARS = 1000  # Longitud máxima por fragmento en el contexto


def sanitize_rag_context(fragments: list[dict]) -> list[dict]:
    """
    Limpia y escapa el contexto recuperado del RAG antes de incluirlo
    en el prompt del LLM, mitigando ataques de Prompt Injection y eliminando emojis.
    """
    sanitized = []
    for frag in fragments:
        original = frag.get("contenido", "")
        cleaned = clean_emojis_and_keycaps(original)
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
                "Fragmento RAG sanitizado (id=%s). Posible intento de Prompt Injection detectado.",
                frag.get("id_fragmento", "desconocido"),
            )

        sanitized.append({**frag, "contenido": cleaned})

    return sanitized

def _find_response_object(text: str) -> dict | None:
    """Primer objeto JSON del texto que tenga la forma de una respuesta del tutor."""
    decoder = json.JSONDecoder(strict=False)  # admite saltos de línea sin escapar en los textos
    for m in re.finditer(r"\{", text):
        try:
            obj, _ = decoder.raw_decode(text, m.start())
        except ValueError:
            continue
        if isinstance(obj, dict) and ("feedback" in obj or "analysis" in obj):
            return obj
    return None


def _read_json_string_field(text: str, key: str) -> str | None:
    """Valor de un campo de texto de un JSON aunque el objeto esté incompleto o mal formado."""
    m = re.search(r'"' + re.escape(key) + r'"\s*:\s*"', text)
    if not m:
        return None
    out, i = [], m.end()
    escapes = {"n": "\n", "t": "\t", "r": "", '"': '"', "\\": "\\", "/": "/"}
    while i < len(text):
        ch = text[i]
        if ch == '"':
            break
        if ch == "\\" and i + 1 < len(text):
            nxt = text[i + 1]
            if nxt == "u" and i + 5 < len(text):
                try:
                    out.append(chr(int(text[i + 2:i + 6], 16)))
                except ValueError:
                    pass
                i += 6
                continue
            out.append(escapes.get(nxt, nxt))
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out).strip() or None


def _is_teaching_example(result: dict) -> bool:
    """Ejemplo que AMY generó por iniciativa propia para explicar con tablas (regla 8)."""
    ex = result.get("live_example")
    if not isinstance(ex, dict) or not ex.get("mermaid_code"):
        return False
    tables = ex.get("tables") or []
    if not tables or not all(isinstance(t, dict) and t.get("columns") for t in tables):
        return False
    return "lienzo" in (result.get("feedback") or "").lower()


def is_example_or_problem_requested(query: str, attachment: dict = None) -> bool:
    """
    Determina de forma estricta si el usuario solicitó un ejemplo, ejercicio o ingresó un problema.
    Las preguntas conceptuales, dudas teóricas o búsquedas NUNCA deben activar un diagrama E-R.
    """
    if attachment:
        # Si el usuario adjuntó un archivo o imagen con un problema/ejercicio
        return True

    if not query or not query.strip():
        return False

    q = query.lower().strip()

    # 1. Descartar explícitamente preguntas teóricas, conceptuales o dudas
    is_conceptual = bool(re.search(
        r'\b(para\s+qu[eé]\s+sirve|qu[eé]\s+es|qu[eé]\s+son|qu[eé]\s+significa|c[oó]mo\s+funciona|'
        r'concepto\s+de|definici[oó]n\s+de|por\s+qu[eé]|diferencia\s+entre|diferencias\s+entre|'
        r'fundamentos?\s+de|ventajas?\s+y\s+desventajas?|teor[ií]a\s+de|explica\s+(?:la|el|qu[eé]|c[oó]mo)|'
        r'duda\s+sobre|historia\s+de|importancia\s+de)\b',
        q,
        re.IGNORECASE
    ))

    # Palabras clave explícitas de solicitud de ejemplo, ejercicio o problema práctico
    has_example_request = bool(re.search(
        r'\b(ejemplo|ejemplos|ejercicio|ejercicios|pr[aá]ctica|pr[aá]cticas|caso\s+pr[aá]ctico|caso\s+de\s+estudio|'
        r'dise[ñn]a|dise[ñn]ame|modela|modelame|crea\s+un\s+diagrama|genera\s+un\s+diagrama|haz\s+un\s+diagrama|'
        r'muestra\s+un\s+diagrama|elabora\s+un\s+diagrama|diagrama\s+e-?r|tengo\s+este\s+problema|'
        r'resuelve\s+este\s+problema|problema:|enunciado:|esquema\s+de\s+tablas\s+para)\b',
        q,
        re.IGNORECASE
    ))

    # Si contiene DDL explícito de un problema que el usuario ingresó
    has_user_ddl = bool(re.search(r'CREATE\s+TABLE', q, re.IGNORECASE))

    if has_user_ddl:
        return True

    if has_example_request:
        return True

    # Si es una pregunta conceptual o duda teórica y NO pidió ejemplo explícito -> False
    if is_conceptual:
        return False

    return False


SCHEMA_DICT = {
    "cliente": [
        {"name": "id_cliente", "type": "INT", "isPk": True},
        {"name": "ci_ruc", "type": "VARCHAR(13)"},
        {"name": "nombres", "type": "VARCHAR(50)"},
        {"name": "apellidos", "type": "VARCHAR(50)"},
        {"name": "telefono", "type": "VARCHAR(15)"},
        {"name": "correo_electronico", "type": "VARCHAR(100)"},
        {"name": "direccion", "type": "VARCHAR(150)"}
    ],
    "empleado": [
        {"name": "id_empleado", "type": "INT", "isPk": True},
        {"name": "ci", "type": "VARCHAR(10)"},
        {"name": "nombres", "type": "VARCHAR(50)"},
        {"name": "apellidos", "type": "VARCHAR(50)"},
        {"name": "cargo", "type": "VARCHAR(60)"},
        {"name": "salario", "type": "DECIMAL(10,2)"},
        {"name": "fecha_ingreso", "type": "DATE"}
    ],
    "factura": [
        {"name": "id_factura", "type": "INT", "isPk": True},
        {"name": "numero_factura", "type": "VARCHAR(20)"},
        {"name": "fecha_emision", "type": "DATE"},
        {"name": "subtotal", "type": "DECIMAL(10,2)"},
        {"name": "iva", "type": "DECIMAL(10,2)"},
        {"name": "total", "type": "DECIMAL(10,2)"},
        {"name": "estado", "type": "VARCHAR(20)"},
        {"name": "id_cliente", "type": "INT", "isFk": True, "references": "Cliente(id_cliente)"},
        {"name": "id_empleado", "type": "INT", "isFk": True, "references": "Empleado(id_empleado)"}
    ],
    "detalle_factura": [
        {"name": "id_detalle", "type": "INT", "isPk": True},
        {"name": "id_factura", "type": "INT", "isFk": True, "references": "Factura(id_factura)"},
        {"name": "id_producto", "type": "INT", "isFk": True, "references": "Producto(id_producto)"},
        {"name": "cantidad", "type": "INT"},
        {"name": "precio_unitario", "type": "DECIMAL(10,2)"},
        {"name": "subtotal_linea", "type": "DECIMAL(10,2)"}
    ],
    "producto": [
        {"name": "id_producto", "type": "INT", "isPk": True},
        {"name": "codigo_producto", "type": "VARCHAR(30)"},
        {"name": "nombre", "type": "VARCHAR(100)"},
        {"name": "descripcion", "type": "TEXT"},
        {"name": "precio_unitario", "type": "DECIMAL(10,2)"},
        {"name": "stock", "type": "INT"},
        {"name": "categoria", "type": "VARCHAR(50)"}
    ],
    "pago": [
        {"name": "id_pago", "type": "INT", "isPk": True},
        {"name": "id_factura", "type": "INT", "isFk": True, "references": "Factura(id_factura)"},
        {"name": "fecha_pago", "type": "TIMESTAMP"},
        {"name": "monto", "type": "DECIMAL(10,2)"},
        {"name": "metodo_pago", "type": "VARCHAR(40)"},
        {"name": "numero_transaccion", "type": "VARCHAR(50)"}
    ],
    "estudiante": [
        {"name": "id_estudiante", "type": "INT", "isPk": True},
        {"name": "ci", "type": "VARCHAR(10)"},
        {"name": "nombres", "type": "VARCHAR(50)"},
        {"name": "apellidos", "type": "VARCHAR(50)"},
        {"name": "correo_electronico", "type": "VARCHAR(100)"},
        {"name": "carrera_universitaria", "type": "VARCHAR(100)"}
    ],
    "curso": [
        {"name": "id_curso", "type": "INT", "isPk": True},
        {"name": "codigo_curso", "type": "VARCHAR(20)"},
        {"name": "nombre_materia", "type": "VARCHAR(100)"},
        {"name": "creditos_academicos", "type": "INT"},
        {"name": "edificio_aula", "type": "VARCHAR(50)"}
    ],
    "inscripcion": [
        {"name": "id_inscripcion", "type": "INT", "isPk": True},
        {"name": "id_estudiante", "type": "INT", "isFk": True, "references": "Estudiante(id_estudiante)"},
        {"name": "id_curso", "type": "INT", "isFk": True, "references": "Curso(id_curso)"},
        {"name": "fecha_inscripcion", "type": "DATE"},
        {"name": "calificacion_final", "type": "DECIMAL(4,2)"}
    ]
}


def parse_mermaid_er(text: str) -> dict | None:
    """
    Parsea bloques 'erDiagram' generados por el LLM en la respuesta.
    Extrae entidades reales, columnas con tipos SQL, PKs, FKs y relaciones.
    """
    if not text or "erDiagram" not in text:
        return None

    m_block = re.search(r'erDiagram([\s\S]*?)(?:```|$)', text)
    if not m_block:
        return None
    diagram_content = m_block.group(1).strip()

    # 1. Parsear relaciones
    # Ej: CLIENTE ||--o{ FACTURA : "1:N emite"
    rel_pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s+([|o}{\-.]{4,10})\s+([A-Za-z0-9_]+)\s*(?::\s*"?([^"\n]*)"?)?', re.M)
    rel_matches = rel_pattern.findall(diagram_content)
    relationships = []
    cardinality_counter = {}
    for from_t, card_symbol, to_t, label in rel_matches:
        from_clean = from_t.strip()
        to_clean = to_t.strip()
        card = '1:N'
        if '}o--o{' in card_symbol or '}o--|{' in card_symbol:
            card = 'N:M'
        elif '||--||' in card_symbol:
            card = '1:1'
        from_name = from_clean.capitalize() if from_clean.isupper() else from_clean
        to_name = to_clean.capitalize() if to_clean.isupper() else to_clean
        relationships.append({
            "fromTable": from_name,
            "toTable": to_name,
            "type": card,
            "label": (label or 'relaciona').strip().strip('"')
        })
        cardinality_counter[card] = cardinality_counter.get(card, 0) + 1

    # 2. Parsear entidades y sus columnas
    # Ej: CLIENTE { int id_cliente PK \n string ci_ruc }
    ent_pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*\{([^}]*)\}', re.M)
    entity_matches = ent_pattern.findall(diagram_content)
    tables = []
    seen_tables = set()

    for ent_name, cols_block in entity_matches:
        raw_name = ent_name.strip()
        table_name = raw_name.capitalize() if raw_name.isupper() else raw_name
        seen_tables.add(table_name.lower())
        cols = []
        for line in cols_block.strip().split('\n'):
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue
            col_match = re.match(r'^([A-Za-z0-9_()]+)\s+([A-Za-z0-9_]+)(?:\s+(PK|FK|UK))?', line, re.I)
            if col_match:
                ctype = col_match.group(1).upper()
                cname = col_match.group(2)
                constr = (col_match.group(3) or '').upper()
                isfk = constr == 'FK'
                ispk = (constr == 'PK') or (not isfk and (cname.lower() == f"id_{raw_name.lower()}" or cname.lower() == 'id'))
                sql_type = 'INT' if ctype in ('INT', 'INTEGER') else \
                           'VARCHAR(50)' if ctype in ('STRING', 'VARCHAR', 'TEXT') else \
                           'DECIMAL(10,2)' if ctype in ('DECIMAL', 'FLOAT', 'NUMERIC') else \
                           'DATE' if ctype == 'DATE' else \
                           'TIMESTAMP' if ctype in ('DATETIME', 'TIMESTAMP') else ctype
                col_obj = {
                    "name": cname,
                    "type": sql_type,
                    "isPk": ispk,
                    "isFk": isfk
                }
                if isfk:
                    m_fk = re.match(r'^id_(\w+)', cname)
                    if m_fk:
                        target = m_fk.group(1).capitalize()
                        col_obj["references"] = f"{target}(id_{m_fk.group(1)})"
                cols.append(col_obj)

        if cols:
            tables.append({"name": table_name, "columns": cols})

    # Si hay tablas en relaciones que no tenían bloque { ... }, agregarlas con atributos estándar
    for r in relationships:
        for tname in (r["fromTable"], r["toTable"]):
            if tname.lower() not in seen_tables:
                seen_tables.add(tname.lower())
                cols = None
                key = tname.lower().rstrip('s')
                for k, s_cols in SCHEMA_DICT.items():
                    if k in key or key in k:
                        cols = s_cols
                        break
                if not cols:
                    cols = [
                        {"name": f"id_{tname.lower()}", "type": "INT", "isPk": True},
                        {"name": "nombre", "type": "VARCHAR(100)", "isPk": False},
                        {"name": "descripcion", "type": "VARCHAR(150)", "isPk": False}
                    ]
                tables.append({"name": tname, "columns": cols})

    if not tables:
        return None

    main_card = max(cardinality_counter, key=cardinality_counter.get) if cardinality_counter else "1:N"

    return {
        "type": "er_diagram",
        "title": f"Modelo: {' — '.join(t['name'] for t in tables)}",
        "cardinality": main_card,
        "description": "Esquema relacional interactivo extraído del modelo de la lección",
        "mermaid_code": "erDiagram\n  " + diagram_content,
        "tables": tables,
        "relationships": relationships
    }


def _generate_dynamic_er(user_query: str, text_content: str, attachment: dict = None) -> dict | None:
    """
    Genera un diagrama E-R dinámico (live_example) ÚNICAMENTE si el usuario
    ha solicitado un ejemplo, ejercicio o ingresado un problema de modelado.
    Extrae las tablas REALES explicadas en text_content (Mermaid, SQL DDL o entidades de BD).
    NUNCA extrae palabras arbitrarias de la pregunta del usuario.
    """
    if not is_example_or_problem_requested(user_query, attachment):
        return None

    # 1. Prioridad 1: Parsear bloque erDiagram de Mermaid generado por el tutor en su respuesta
    mermaid_ex = parse_mermaid_er(text_content)
    if mermaid_ex:
        return mermaid_ex

    # 2. Prioridad 2: Parsear sentencias CREATE TABLE en la respuesta del tutor
    table_matches = re.findall(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\']?(\w+)["`\']?\s*\(([\s\S]*?)\);?',
        text_content, re.IGNORECASE
    )
    if table_matches:
        tables = []
        for tname, col_block in table_matches:
            cols = []
            lines = [l.strip() for l in col_block.split(',') if l.strip()]
            for line in lines:
                if re.match(r'^\s*(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK)', line, re.I):
                    continue
                cm = re.match(r'^["`\']?(\w+)["`\']?\s+([\w()]+)', line, re.I)
                if cm:
                    cname, ctype = cm.group(1), cm.group(2).upper()
                    ispk = 'PRIMARY KEY' in line.upper() or 'SERIAL' in line.upper() or cname.lower().startswith('id')
                    cols.append({"name": cname, "type": ctype, "isPk": ispk})
            if cols:
                tables.append({"name": tname, "columns": cols})
        if len(tables) >= 2:
            mermaid_lines = ["erDiagram"]
            for i in range(len(tables) - 1):
                mermaid_lines.append(f'  {tables[i]["name"]} ||--o{{ {tables[i+1]["name"]} : "relaciona"')
            for t in tables:
                mermaid_lines.append(f'  {t["name"]} {{')
                for c in t["columns"]:
                    const = "PK" if c.get("isPk") else "FK" if c.get("isFk") else ""
                    mermaid_lines.append(f'    {c["type"]} {c["name"]}{" " + const if const else ""}')
                mermaid_lines.append("  }")
            return {
                "type": "er_diagram",
                "title": f"Modelo: {' — '.join(t['name'] for t in tables)}",
                "cardinality": "1:N",
                "description": "Esquema relacional extraído de las sentencias SQL",
                "mermaid_code": "\n".join(mermaid_lines),
                "tables": tables
            }

    # 3. Prioridad 3: Buscar entidades de base de datos reconocidas en el texto del tutor
    found_entities = []
    for ent_key in SCHEMA_DICT.keys():
        if re.search(r'\b' + ent_key + r's?\b', text_content, re.I):
            cap_name = ent_key.replace('_', ' ').title().replace(' ', '_')
            if cap_name not in found_entities:
                found_entities.append(cap_name)

    if len(found_entities) >= 2:
        tables = []
        for name in found_entities[:5]:
            key = name.lower()
            cols = SCHEMA_DICT.get(key)
            if not cols:
                key = key.rstrip('s')
                cols = SCHEMA_DICT.get(key)
            if cols:
                tables.append({"name": name, "columns": cols})

        if len(tables) >= 2:
            mermaid_lines = ["erDiagram"]
            for i in range(len(tables) - 1):
                mermaid_lines.append(f'  {tables[i]["name"]} ||--o{{ {tables[i+1]["name"]} : "relaciona"')
            for t in tables:
                mermaid_lines.append(f'  {t["name"]} {{')
                for c in t["columns"]:
                    const = "PK" if c.get("isPk") else "FK" if c.get("isFk") else ""
                    mermaid_lines.append(f'    {c["type"]} {c["name"]}{" " + const if const else ""}')
                mermaid_lines.append("  }")
            return {
                "type": "er_diagram",
                "title": f"Modelo: {' — '.join(t['name'] for t in tables)}",
                "cardinality": "1:N",
                "description": "Esquema relacional interactivo de la lección",
                "mermaid_code": "\n".join(mermaid_lines),
                "tables": tables
            }

    return None


def validate_response(response_text: str, student_query: str = "", attachment: dict = None) -> dict:
    """
    Valida y parsea la respuesta del modelo.
    Garantiza que feedback NUNCA contenga bloques de codigo JSON crudos.
    """
    if not response_text or not response_text.strip():
        return {
            "analysis": "Respuesta vacia del modelo.",
            "feedback": "No pude procesar tu consulta. Intentalo de nuevo.",
            "topic": "General",
            "live_example": None
        }

    text = response_text.strip()

    # 0. Despojar de bloques markdown ```json ... ``` exteriores
    cleaned_text = text
    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text, flags=re.IGNORECASE)
        cleaned_text = re.sub(r"\s*```$", "", cleaned_text)
        cleaned_text = cleaned_text.strip()

    result = None

    # 1. Parsear JSON directo
    try:
        result = json.loads(cleaned_text)
    except Exception:
        pass

    # 1b. JSON precedido de texto ("...pilares fundamentales{ "analysis": ...") o con saltos de
    #     línea sin escapar: se busca el objeto con un decodificador tolerante
    if not result:
        result = _find_response_object(cleaned_text)

    # 2. Buscar bloque JSON { ... }
    if not result:
        first_b = cleaned_text.find('{')
        last_b = cleaned_text.rfind('}')
        if first_b != -1 and last_b != -1 and last_b > first_b:
            candidate = cleaned_text[first_b:last_b + 1]
            try:
                result = json.loads(candidate)
            except Exception:
                try:
                    fixed = re.sub(r'[\x00-\x1f\x7f]', ' ', candidate)
                    result = json.loads(fixed)
                except Exception:
                    pass

    # 3. JSON roto: leer el valor de "feedback" respetando los escapes (\" \n \uXXXX)
    if not result:
        feedback = _read_json_string_field(cleaned_text, "feedback")
        if feedback:
            topic_m = re.search(r'"topic"\s*:\s*"([^"]*)"', cleaned_text)
            result = {
                "analysis": _read_json_string_field(cleaned_text, "analysis") or "Sintesis del tema.",
                "feedback": feedback,
                "topic": topic_m.group(1) if topic_m else "General",
                "live_example": None
            }

    # 4. Fallback final: limpiar caracteres JSON de texto libre
    if not result or not isinstance(result, dict):
        clean_text = re.sub(r'```(?:json)?', '', text)
        clean_text = re.sub(r'^\s*\{\s*"analysis"[\s\S]*?"feedback"\s*:\s*"', '', clean_text)
        clean_text = re.sub(r'"\s*,\s*"topic"[\s\S]*$', '', clean_text)
        clean_text = clean_text.replace('```', '').strip()
        result = {
            "analysis": "Respuesta procesada.",
            "feedback": clean_text if clean_text else text,
            "topic": "General",
            "live_example": None
        }

    result.setdefault("analysis", "Sin analisis disponible.")
    result.setdefault("feedback", "¿Podrias darme mas detalles sobre tu duda?")
    result.setdefault("topic", "General")
    result.setdefault("live_example", None)

    # Limpiar agresivamente si feedback arranca con ```json o {
    # (también si el JSON quedó incrustado a mitad del texto)
    fb = str(result.get("feedback", ""))
    if fb.strip().startswith("```json") or fb.strip().startswith("{") or re.search(r'\{\s*"(analysis|feedback)"\s*:', fb):
        inner = _find_response_object(re.sub(r"```(?:json)?", "", fb))
        if isinstance(inner, dict) and inner.get("feedback"):
            result["feedback"] = inner["feedback"]
            if inner.get("live_example"):
                result["live_example"] = inner["live_example"]
            if inner.get("topic"):
                result["topic"] = inner["topic"]
        else:
            inner_fb = _read_json_string_field(fb, "feedback")
            if inner_fb:
                result["feedback"] = inner_fb

    # REGLA FUNDAMENTAL: sin una petición de ejemplo o problema, live_example es None, salvo un
    # ejemplo didáctico que AMY decidió mostrar a un principiante (tablas válidas y anunciado
    # en la respuesta "en el lienzo de la derecha"), según la regla 8 del prompt
    if not is_example_or_problem_requested(student_query, attachment):
        if not _is_teaching_example(result):
            result["live_example"] = None
    else:
        live_example = result.get("live_example")
        if live_example and isinstance(live_example, dict) and live_example.get("mermaid_code"):
            pass
        else:
            dynamic_ex = _generate_dynamic_er(student_query, result.get("feedback", ""), attachment)
            if dynamic_ex:
                result["live_example"] = dynamic_ex
            else:
                result["live_example"] = None

    # El prompt enumera los temas sin tildes: se normalizan antes de validar
    result["topic"] = TOPIC_ALIASES.get(result["topic"], result["topic"])
    if result["topic"] not in ALLOWED_TOPICS:
        result["topic"] = "General"

    # Eliminación estricta de cualquier residuo de emoji o numeración keycap
    if isinstance(result.get("feedback"), str):
        result["feedback"] = clean_emojis_and_keycaps(result["feedback"])
    if isinstance(result.get("analysis"), str):
        result["analysis"] = clean_emojis_and_keycaps(result["analysis"])
    if isinstance(result.get("topic"), str):
        result["topic"] = clean_emojis_and_keycaps(result["topic"])

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
