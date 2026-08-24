"""
AMY — Evaluador Pedagógico y Clasificador de Aprendizaje RAG
Analiza archivos e imágenes adjuntas por los usuarios.
Evalúa si aportan contenido teórico o formativo sobre Fundamentos de Bases de Datos.
Si aportan valor, los vectoriza e indexa en PostgreSQL (pgvector).
Si no aportan valor generalizable, evita la contaminación de la base de conocimiento.
"""

import base64
import json
import logging
import re
from typing import Tuple, Optional

from app.database.connection import db
from app.integrations.gemini_client import gemini_client
from app.rag.chunker import chunk_text
from app.rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)


def _extract_plain_text(base64_str: str) -> Optional[str]:
    """Decodifica texto plano en base64."""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        decoded = base64.b64decode(base64_str).decode("utf-8", errors="ignore")
        return decoded.strip()
    except Exception as e:
        logger.warning("Error decodificando texto plano: %s", e)
        return None


async def evaluate_and_index_attachment(
    filename: str,
    mime_type: str,
    base64_data: str,
    student_query: str = ""
) -> Tuple[bool, str, str]:
    """
    Evalúa si un documento o imagen adjunta aporta al aprendizaje formativo de Bases de Datos.
    
    Retorna:
        (is_learned: bool, reason: str, detected_topic: str)
    """
    if not base64_data:
        return False, "No se recibieron datos adjuntos.", "General"

    logger.info("Iniciando evaluación pedagógica del adjunto: %s (%s)", filename, mime_type)

    attachment_dict = {
        "filename": filename,
        "mime_type": mime_type,
        "base64_data": base64_data
    }

    # Prompt de evaluación pedagógica
    eval_prompt = f"""
Actúa como un Evaluador Pedagógico Senior en la materia de Fundamentos de Bases de Datos de la Universidad Politécnica Estatal del Carchi (UPEC).

El estudiante adjuntó el archivo "{filename}" ({mime_type}) con la siguiente consulta: "{student_query}".

Tu objetivo es clasificar si el contenido del archivo/imagen aporta conocimiento conceptual, teórico o técnico generalizable sobre:
- Modelo Entidad-Relación (entidades, atributos, cardinalidades, relaciones, MER).
- Esquemas Relacionales y Normalización (1FN, 2FN, 3FN, BCNF, dependencias funcionales, anomalías).
- Álgebra Relacional (selección, proyección, join, producto cartesiano, división, unión).
- Lenguaje SQL (DDL: CREATE/ALTER, DML: SELECT, JOINs, subconsultas, GROUP BY, funciones agregadas).
- Transacciones y Concurrencia (propiedades ACID, bloqueos, aislamiento).
- Almacenamiento, Índices y Optimización de Consultas.

REGLAS DE DECISIÓN:
1. SI ES FORMATIVO: Si contiene definiciones, esquemas claros, ejercicios resueltos con explicación, reglas de diseño o sintaxis SQL estructurada, clasifícalo como is_educational = true.
2. NO ES FORMATIVO: Si es un saludo, una tarea personal sin explicación, una imagen borrosa/irrelevante, un meme o un archivo no relacionado con bases de datos, clasifícalo como is_educational = false.

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
```json
{{
  "is_educational": true,
  "score": 8,
  "topic": "Normalización",
  "reason": "El documento explica las reglas de la 2FN y 3FN con ejemplos de tablas y dependencias funcionales.",
  "clean_knowledge_text": "Resumen pedagógico y transcripción limpia de las definiciones, esquemas y conceptos técnicos encontrados en el archivo para enriquecer la base de conocimiento."
}}
```
"""

    try:
        raw_eval = await gemini_client.generate(
            prompt=eval_prompt,
            system="Eres un evaluador de contenido académico estricto y preciso. Responde siempre en formato JSON limpio sin emojis.",
            attachment=attachment_dict
        )

        # Parsear JSON de la evaluación
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_eval, re.DOTALL)
        if match:
            eval_data = json.loads(match.group(1).strip())
        else:
            first_brace = raw_eval.find('{')
            last_brace = raw_eval.rfind('}')
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                eval_data = json.loads(raw_eval[first_brace:last_brace + 1])
            else:
                eval_data = {}

        is_educational = bool(eval_data.get("is_educational", False))
        score = int(eval_data.get("score", 0))
        topic = str(eval_data.get("topic", "General"))
        reason = str(eval_data.get("reason", "Procesado para la respuesta del estudiante."))
        clean_text = str(eval_data.get("clean_knowledge_text", "")).strip()

        logger.info(
            "Resultado de evaluación para %s: is_educational=%s, score=%d, topic=%s",
            filename, is_educational, score, topic
        )

        # Si supera el umbral pedagógico y contiene texto suficiente, indexar en PostgreSQL (pgvector)
        if is_educational and score >= 6 and len(clean_text) >= 50:
            chunks = chunk_text(clean_text)
            indexed_count = 0

            for chunk in chunks:
                chunk_str = chunk.text if hasattr(chunk, "text") else str(chunk)
                if len(chunk_str.strip()) < 30:
                    continue

                try:
                    # Generar embedding vectorial (768 dimensiones)
                    emb = await generate_embedding(chunk_str)
                    emb_str = f"[{','.join(f'{x:.6f}' for x in emb)}]" if emb else None

                    metadata_json = json.dumps({
                        "source": "aporte_usuario",
                        "filename": filename,
                        "topic": topic,
                        "score": score
                    })

                    await db.execute(
                        """INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata, embedding)
                           VALUES ($1, $2, $3::jsonb, $4::vector)""",
                        topic,
                        chunk_str,
                        metadata_json,
                        emb_str
                    )
                    indexed_count += 1
                except Exception as chunk_err:
                    logger.error("Error al indexar fragmento de %s: %s", filename, chunk_err)

            logger.info("Se indexaron %d fragmentos del adjunto %s en fragmentos_conocimiento", indexed_count, filename)
            return True, f"Documento analizado e indexado ({indexed_count} fragmentos añadidos a la base de conocimiento). {reason}", topic

        return False, reason, topic

    except Exception as e:
        logger.error("Error en la evaluación pedagógica del adjunto %s: %s", filename, e)
        return False, "El archivo fue procesado para responder tu consulta.", "General"
