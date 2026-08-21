"""
AMY — Chunker Adaptativo (Fragmentador de Documentos)
Divide documentos largos en fragmentos manejables para el sistema RAG.
Reconoce estructuras de bases de datos (DDL/DML SQL, diagramas Mermaid/ER)
y evita cortar sentencias SQL o explicaciones relacionales a la mitad.
"""

import re
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class ContentType(str, Enum):
    SQL = "sql"
    MERMAID = "mermaid"
    TEXT = "text"


# ── Patrones de reconocimiento SQL ───────────────────────────────────────────

_SQL_STATEMENT_STARTERS = re.compile(
    r"^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|WITH|GRANT|REVOKE|TRUNCATE|BEGIN|COMMIT|ROLLBACK)",
    re.IGNORECASE | re.MULTILINE,
)

_SQL_FENCED_BLOCK = re.compile(
    r"```(?:sql|SQL|pgsql|postgresql)\s*(.*?)```",
    re.DOTALL,
)

_MERMAID_FENCED_BLOCK = re.compile(
    r"```(?:mermaid|erDiagram|ER)\s*(.*?)```",
    re.DOTALL,
)

# Palabras clave que determinan contenido SQL en texto plano
_SQL_DENSITY_KEYWORDS = [
    "create table", "alter table", "drop table", "insert into",
    "select ", "foreign key", "primary key", "references ", "not null",
    "constraint ", "on delete", "on update",
]


def detect_content_type(text: str) -> ContentType:
    """
    Detecta si el texto es predominantemente SQL, Mermaid o texto natural.
    Retorna ContentType.SQL, ContentType.MERMAID o ContentType.TEXT.
    """
    text_lower = text.lower()

    # Detectar bloques cercados Mermaid
    if _MERMAID_FENCED_BLOCK.search(text):
        return ContentType.MERMAID

    # Detectar erDiagram en texto plano
    if "erdiagram" in text_lower or ("entity" in text_lower and "relationship" in text_lower):
        return ContentType.MERMAID

    # Detectar bloques cercados SQL
    if _SQL_FENCED_BLOCK.search(text):
        return ContentType.SQL

    # Detectar SQL plano por densidad de keywords
    sql_hits = sum(1 for kw in _SQL_DENSITY_KEYWORDS if kw in text_lower)
    if sql_hits >= 2 or _SQL_STATEMENT_STARTERS.search(text):
        return ContentType.SQL

    return ContentType.TEXT


# ── Extractor de bloques SQL atómicos ────────────────────────────────────────

def _extract_sql_blocks(text: str) -> list[str]:
    """
    Extrae bloques SQL del texto manteniendo sentencias completas.
    Prioriza bloques cercados ```sql ... ``` y divide el resto por ';'.
    Cada bloque DDL es una unidad atómica que no se debe cortar.
    """
    blocks: list[str] = []

    # 1. Extraer bloques cercados
    fenced_positions: list[tuple[int, int]] = []
    for m in _SQL_FENCED_BLOCK.finditer(text):
        sql_content = m.group(1).strip()
        if sql_content:
            stmts = _split_by_semicolons(sql_content)
            blocks.extend(stmts)
        fenced_positions.append((m.start(), m.end()))

    # 2. Procesar el texto restante (fuera de los bloques cercados)
    if not fenced_positions:
        remaining = text
    else:
        remaining_parts = []
        prev = 0
        for start, end in fenced_positions:
            remaining_parts.append(text[prev:start])
            prev = end
        remaining_parts.append(text[prev:])
        remaining = "\n".join(remaining_parts)

    if remaining.strip():
        if _SQL_STATEMENT_STARTERS.search(remaining):
            stmts = _split_by_semicolons(remaining)
            blocks.extend(stmts)
        else:
            blocks.append(remaining.strip())

    return [b for b in blocks if b.strip()]


def _split_by_semicolons(sql_text: str) -> list[str]:
    """
    Divide SQL en sentencias completas separadas por ';'.
    Preserva CREATE TABLE como bloques atómicos; agrupa DML relacionados.
    """
    raw_stmts = re.split(r";\s*\n|;\s*$", sql_text, flags=re.MULTILINE)
    stmts = []
    current_group: list[str] = []
    current_len = 0
    MAX_GROUP_WORDS = 600  # palabras máximas por chunk DML agrupado

    for stmt in raw_stmts:
        stmt = stmt.strip()
        if not stmt:
            continue
        stmt_words = len(stmt.split())
        is_ddl = re.match(r"^\s*(CREATE|ALTER|DROP)\s+TABLE", stmt, re.IGNORECASE)

        if is_ddl:
            # Cerrar grupo DML actual antes del DDL
            if current_group:
                stmts.append(";\n".join(current_group) + ";")
                current_group = []
                current_len = 0
            stmts.append(stmt + ";")
        else:
            if current_len + stmt_words > MAX_GROUP_WORDS and current_group:
                stmts.append(";\n".join(current_group) + ";")
                current_group = []
                current_len = 0
            current_group.append(stmt)
            current_len += stmt_words

    if current_group:
        stmts.append(";\n".join(current_group) + ";")

    return stmts


# ── Extractor de bloques Mermaid ──────────────────────────────────────────────

def _extract_mermaid_blocks(text: str) -> list[str]:
    """
    Extrae diagramas Mermaid como bloques atómicos sin fragmentar.
    """
    blocks: list[str] = []
    fenced_positions: list[tuple[int, int]] = []

    for m in _MERMAID_FENCED_BLOCK.finditer(text):
        blocks.append(m.group(0).strip())
        fenced_positions.append((m.start(), m.end()))

    if fenced_positions:
        remaining_parts = []
        prev = 0
        for start, end in fenced_positions:
            remaining_parts.append(text[prev:start])
            prev = end
        remaining_parts.append(text[prev:])
        remaining = "\n".join(remaining_parts).strip()
        if remaining:
            blocks.append(remaining)
    else:
        blocks.append(text.strip())

    return [b for b in blocks if b.strip()]


# ── Chunker principal ─────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> list[str]:
    """
    Fragmenta un texto en chunks con solapamiento usando estrategia adaptativa.

    - Si el texto contiene SQL (DDL/DML): preserva sentencias completas como
      unidades atómicas y agrupa las relacionadas. Nunca corta un bloque SQL.
    - Si contiene Mermaid/ER: preserva el diagrama completo como chunk único.
    - Si es texto natural: usa división por oraciones con solapamiento.

    Args:
        text: Texto completo a fragmentar.
        chunk_size: Número aproximado de palabras por fragmento (texto natural).
        chunk_overlap: Número de palabras de solapamiento entre fragmentos.

    Returns:
        Lista de fragmentos de texto.
    """
    if not text or not text.strip():
        return []

    content_type = detect_content_type(text)
    logger.info("Tipo de contenido detectado: %s", content_type.value)

    if content_type == ContentType.SQL:
        chunks = _extract_sql_blocks(text)
        logger.info("SQL fragmentado en %d bloques atómicos", len(chunks))
        return chunks

    if content_type == ContentType.MERMAID:
        chunks = _extract_mermaid_blocks(text)
        logger.info("Mermaid fragmentado en %d bloques", len(chunks))
        return chunks

    # ── Modo texto natural ────────────────────────────────────────────────────
    cleaned = clean_text(text)
    sentences = split_into_sentences(cleaned)

    chunks = []
    current_chunk: list[str] = []
    current_word_count = 0

    for sentence in sentences:
        sentence_words = len(sentence.split())

        if sentence_words > chunk_size:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_word_count = 0

            words = sentence.split()
            for i in range(0, len(words), chunk_size - chunk_overlap):
                sub_chunk = " ".join(words[i:i + chunk_size])
                if sub_chunk.strip():
                    chunks.append(sub_chunk)
            continue

        if current_word_count + sentence_words > chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            overlap_text = " ".join(current_chunk)
            overlap_words = overlap_text.split()[-chunk_overlap:]
            current_chunk = overlap_words
            current_word_count = len(overlap_words)

        current_chunk.append(sentence)
        current_word_count += sentence_words

    if current_chunk:
        final = " ".join(current_chunk)
        if final.strip():
            chunks.append(final)

    logger.info("Texto fragmentado en %d chunks (tamano objetivo: %d palabras)", len(chunks), chunk_size)
    return chunks


def clean_text(text: str) -> str:
    """Limpia un texto removiendo espacios excesivos y caracteres especiales."""
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    text = text.replace('\t', ' ')
    return text.strip()


def split_into_sentences(text: str) -> list[str]:
    """
    Divide texto en oraciones usando heurísticas.
    Maneja abreviaciones comunes en español.
    """
    abbreviations = ['Dr', 'Dra', 'Sr', 'Sra', 'Ing', 'Lic', 'Prof', 'etc', 'vs', 'p.ej']
    for abbr in abbreviations:
        text = text.replace(f'{abbr}.', f'{abbr}<<DOT>>')

    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.replace('<<DOT>>', '.') for s in sentences]
    return [s.strip() for s in sentences if s.strip()]
