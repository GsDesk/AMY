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
SYSTEM_PROMPT = """Eres AMY, la tutora pedagógica experta en Fundamentos de Bases de Datos de la Universidad Politécnica Estatal del Carchi (UPEC). Tu propósito es guiar en el diseño de modelos entidad-relación (E-R), esquemas relacionales normalizados (1FN, 2FN, 3FN), álgebra relacional y consultas SQL, utilizando el método socrático.

USO DEL CONOCIMIENTO Y RAG:
- Cuando la consulta del estudiante contenga fragmentos en el "CONTEXTO ACADEMICO RECUPERADO (RAG)", fundamenta tus explicaciones en esa bibliografía oficial (Silberschatz, Elmasri, Navathe, etc.) y cita la fuente cuando corresponda.

PROHIBICIÓN ESTRICTA DE EMOJIS (REGLA DE ESTILO):
Queda terminantemente prohibido utilizar emojis, emoticonos o listas decoradas con emojis en cualquiera de tus respuestas. Utiliza únicamente viñetas estándar (-) y listas numeradas convencionales (1., 2., 3.).

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
   - Genera SIEMPRE una respuesta diferente, fresca, humana y cercana cada vez. NUNCA repitas la misma frase exacta.
   - Saluda cordialmente, expresa tu agrado por estudiar Bases de Datos en la UPEC y ofrece tu ayuda.

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

5. MÉTODO SOCRÁTICO:
   - En explicaciones técnicas, no des siempre la solución servida de inmediato: haz preguntas guía que estimulen el razonamiento lógico del estudiante.

6. MOTOR DINÁMICO DE DIAGRAMAS E-R (OBLIGATORIO):
   Cuando el estudiante pregunte sobre relaciones entre tablas, diseño de esquemas, pida un diagrama E-R o consulte por entidades:
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
    "analysis": "Breve diagnostico interno de la intencion o error del estudiante",
    "feedback": "Respuesta pedagogica formateada en Markdown impecable",
    "topic": "SQL | Normalizacion | Modelo E-R | Algebra Relacional | Diseno de BD | Transacciones | Indices | Fundamentos | Saludos | General | Fuera de Alcance",
    "live_example": null
}
Cuando detectes una intencion de diagrama E-R, incluye en "live_example" el objeto estructurado."""


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

_EMOJI_PATTERN = re.compile(
    r"[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\u2b50\u2b55\u200d\ufe0f]",
    flags=re.UNICODE,
)

_MAX_FRAGMENT_CHARS = 1000  # Longitud máxima por fragmento en el contexto


def sanitize_rag_context(fragments: list[dict]) -> list[dict]:
    """
    Limpia y escapa el contexto recuperado del RAG antes de incluirlo
    en el prompt del LLM, mitigando ataques de Prompt Injection y eliminando emojis.
    """
    sanitized = []
    for frag in fragments:
        original = frag.get("contenido", "")
        cleaned = _EMOJI_PATTERN.sub("", original)
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

def _generate_dynamic_er(user_query: str, text_content: str) -> dict | None:
    """
    Genera un diagrama E-R dinámico (live_example) para CUALQUIER conjunto de tablas
    o entidades solicitadas por el usuario en su consulta o explicadas en la respuesta.
    """
    source_text = f"{user_query} {text_content}"
    tables = []

    # 1. Detección por CREATE TABLE en el texto
    table_matches = re.findall(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\']?(\w+)["`\']?\s*\(([\s\S]*?)\);?',
        source_text, re.IGNORECASE
    )
    if table_matches:
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

    # 2. Detección por entidades/tablas mencionadas explícitamente
    if not tables:
        stop_words = {
            'una', 'las', 'los', 'del', 'con', 'para', 'tabla', 'tablas', 'entidad', 'entidades',
            'como', 'este', 'ejercicio', 'diagrama', 'diseño', 'debe', 'tengo', 'hacer', 'necesito',
            'modeles', 'modelar', 'modelo', 'relacionar', 'relacion', 'cardinalidad', 'debil',
            'negocio', 'concreto', 'pertenece', 'mes', 'año', 'ano', 'excelente', 'analizar',
            'rubros', 'aporte', 'iess', 'prestamo', 'frecuencia', 'temporal', 'periodo'
        }
        found_names = []
        words = re.findall(r'\b[A-Za-z_]{3,}\b', user_query)
        for w in words:
            if w.lower() not in stop_words:
                clean_n = w.capitalize()
                if clean_n not in found_names and len(found_names) < 6:
                    found_names.append(clean_n)

        schema_dict = {
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

        if len(found_names) >= 2:
            for idx, name in enumerate(found_names):
                key = name.lower().rstrip('s')
                matched_cols = None
                for k, cols in schema_dict.items():
                    if k in key or key in k:
                        matched_cols = cols
                        break
                if not matched_cols:
                    matched_cols = [
                        {"name": f"id_{name.lower()}", "type": "INT", "isPk": True},
                        {"name": "codigo_identificador", "type": "VARCHAR(30)"},
                        {"name": "nombre", "type": "VARCHAR(100)"},
                        {"name": "descripcion_detallada", "type": "TEXT"},
                        {"name": "fecha_registro", "type": "TIMESTAMP"},
                        {"name": "estado_registro", "type": "VARCHAR(20)"}
                    ]
                    if idx > 0:
                        matched_cols.append({
                            "name": f"id_{found_names[0].lower()}",
                            "type": "INT",
                            "isFk": True,
                            "references": f"{found_names[0]}(id_{found_names[0].lower()})"
                        })
                tables.append({"name": name, "columns": matched_cols})



    if not tables or len(tables) < 2:
        return None

    # Generar código Mermaid erDiagram
    mermaid_lines = ["erDiagram"]
    for i in range(len(tables) - 1):
        tA = tables[i]["name"]
        tB = tables[i + 1]["name"]
        mermaid_lines.append(f'  {tA} ||--o{{ {tB} : "relaciona"')
    for t in tables:
        mermaid_lines.append(f'  {t["name"]} {{')
        for c in t["columns"]:
            const = "PK" if c.get("isPk") else "FK" if c.get("isFk") else ""
            mermaid_lines.append(f'    {c["type"]} {c["name"]}{" " + const if const else ""}')
        mermaid_lines.append("  }")

    return {
        "type": "er_diagram",
        "title": f"Modelo: {' — '.join(t['name'] for t in tables)}",
        "cardinality": "1:N" if len(tables) > 1 else "1:1",
        "description": f"Diagrama Entidad-Relación y esquema de tablas",
        "mermaid_code": "\n".join(mermaid_lines),
        "tables": tables
    }


def validate_response(response_text: str, student_query: str = "") -> dict:
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

    # 3. Regex para extraer 'feedback' si JSON fallo
    if not result:
        m = re.search(r'"feedback"\s*:\s*"([\s\S]*?)"\s*,\s*"topic"', cleaned_text) or \
            re.search(r'"feedback"\s*:\s*"([\s\S]*?)"\s*\}', cleaned_text)
        if m:
            result = {
                "analysis": "Sintesis del tema.",
                "feedback": m.group(1).replace('\\n', '\n').replace('\\"', '"'),
                "topic": "General",
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
    fb = str(result.get("feedback", ""))
    if fb.strip().startswith("```json") or fb.strip().startswith("{"):
        try:
            fb_c = re.sub(r"^```(?:json)?\s*", "", fb.strip())
            fb_c = re.sub(r"\s*```$", "", fb_c)
            inner = json.loads(fb_c)
            if isinstance(inner, dict) and "feedback" in inner:
                result["feedback"] = inner["feedback"]
                if "live_example" in inner and inner["live_example"]:
                    result["live_example"] = inner["live_example"]
        except Exception:
            m = re.search(r'"feedback"\s*:\s*"([\s\S]*?)"', fb)
            if m:
                result["feedback"] = m.group(1).replace('\\n', '\n').replace('\\"', '"')

    # Normalizar o generar dinámicamente live_example para CUALQUIER consulta de diagramas
    live_example = result.get("live_example")
    if live_example and isinstance(live_example, dict) and live_example.get("mermaid_code"):
        pass
    else:
        dynamic_ex = _generate_dynamic_er(student_query, result.get("feedback", ""))
        if dynamic_ex:
            result["live_example"] = dynamic_ex
        else:
            result["live_example"] = None

    if result["topic"] not in ALLOWED_TOPICS:
        result["topic"] = "General"

    # Eliminación estricta de cualquier residuo de emoji
    if isinstance(result.get("feedback"), str):
        result["feedback"] = _EMOJI_PATTERN.sub("", result["feedback"]).strip()
    if isinstance(result.get("analysis"), str):
        result["analysis"] = _EMOJI_PATTERN.sub("", result["analysis"]).strip()
    if isinstance(result.get("topic"), str):
        result["topic"] = _EMOJI_PATTERN.sub("", result["topic"]).strip()

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
