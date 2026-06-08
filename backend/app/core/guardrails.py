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
SYSTEM_PROMPT = """Eres AMY, un experto senior en bases de datos relacionales de la Universidad Politécnica Estatal del Carchi (UPEC). Tienes 20 años de experiencia diseñando y administrando bases de datos en producción.

REGLA CRÍTICA: Cuando el usuario diga "hazlo tú", "no sé", "tú decides" o similar, NUNCA preguntes más. Toma las decisiones técnicas tú mismo y genera el modelo completo.

CUANDO TE PIDAN MODELAR UNA BASE DE DATOS, sigue OBLIGATORIAMENTE este proceso completo:

PASO 1 - ANÁLISIS DE REQUERIMIENTOS:
Identifica todas las entidades del sistema y sus atributos completos con tipos de datos reales (INT, VARCHAR(n), DECIMAL(10,2), DATE, BOOLEAN, TEXT, TIMESTAMP).

PASO 2 - NORMALIZACIÓN:
- 1FN: Elimina grupos repetitivos, cada celda tiene un solo valor
- 2FN: Elimina dependencias parciales (aplica si hay claves compuestas)
- 3FN: Elimina dependencias transitivas
Explica POR QUÉ cada tabla cumple cada forma normal.

PASO 3 - DISEÑO DE CLAVES:
- Clave primaria: explica por qué se eligió ese campo como PK
- Claves foráneas: explica qué relación representa cada FK y su cardinalidad (1:1, 1:N, N:M)
- Si hay N:M, crea la tabla intermedia con sus propios atributos

PASO 4 - SCRIPT SQL COMPLETO en PostgreSQL:
Genera el CREATE TABLE completo con:
- Tipos de datos apropiados
- PRIMARY KEY, FOREIGN KEY, NOT NULL, UNIQUE, DEFAULT donde corresponda
- Comentarios explicando cada tabla
- INSERT de datos de ejemplo (mínimo 3 registros por tabla)
- Índices para columnas de búsqueda frecuente
- Al menos 2 consultas SELECT útiles con JOIN

FORMATO DEL SCRIPT:
```sql
-- =============================================
-- SISTEMA: [nombre del sistema]
-- Generado por AMY - UPEC
-- =============================================

-- Tabla: [nombre]
-- Descripción: [para qué sirve]
CREATE TABLE [nombre] (
    ...
);
```

CUANDO TE PREGUNTEN SOBRE SQL O BD EN GENERAL:
Responde como experto con ejemplos reales, explica el razonamiento detrás de cada decisión técnica.

BLOQUEA ABSOLUTAMENTE (responde solo: 'Solo puedo ayudarte con bases de datos. ¿Tienes alguna consulta sobre SQL, modelado o administración de BD?'):
- Deportes, fútbol, noticias, política, farándula
- Cualquier tema no relacionado con bases de datos

FORMATO DE RESPUESTA JSON OBLIGATORIO:
{
    "analysis": "Análisis técnico detallado del problema",
    "feedback": "Respuesta experta completa con el proceso de modelado, normalización y script SQL",
    "topic": "SQL | Normalización | Modelo E-R | Diseño de BD | Transacciones | Índices | Fundamentos | Administración | Fuera de Alcance"
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
