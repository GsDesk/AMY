"""
Tutor IA UPEC — Chunker (Fragmentador de Documentos)
Divide documentos largos en fragmentos manejables para el sistema RAG.
"""

import re
import logging

logger = logging.getLogger(__name__)


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> list[str]:
    """
    Fragmenta un texto largo en chunks con solapamiento.
    
    Args:
        text: Texto completo a fragmentar.
        chunk_size: Número aproximado de palabras por fragmento.
        chunk_overlap: Número de palabras de solapamiento entre fragmentos.
    
    Returns:
        Lista de fragmentos de texto.
    """
    if not text or not text.strip():
        return []

    # Limpiar el texto
    cleaned = clean_text(text)
    
    # Dividir por oraciones primero para no cortar a mitad de una
    sentences = split_into_sentences(cleaned)
    
    chunks = []
    current_chunk = []
    current_word_count = 0

    for sentence in sentences:
        sentence_words = len(sentence.split())
        
        # Si una sola oración excede el tamaño del chunk, dividir por palabras
        if sentence_words > chunk_size:
            # Guardar lo acumulado
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_word_count = 0
            
            # Dividir la oración larga por palabras
            words = sentence.split()
            for i in range(0, len(words), chunk_size - chunk_overlap):
                sub_chunk = " ".join(words[i:i + chunk_size])
                if sub_chunk.strip():
                    chunks.append(sub_chunk)
            continue

        # Si agregar esta oración excede el límite, crear nuevo chunk
        if current_word_count + sentence_words > chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            
            # Solapamiento: tomar las últimas palabras del chunk anterior
            overlap_text = " ".join(current_chunk)
            overlap_words = overlap_text.split()[-chunk_overlap:]
            current_chunk = overlap_words
            current_word_count = len(overlap_words)

        current_chunk.append(sentence)
        current_word_count += sentence_words

    # No olvidar el último chunk
    if current_chunk:
        final = " ".join(current_chunk)
        if final.strip():
            chunks.append(final)

    logger.info(f"📄 Texto fragmentado en {len(chunks)} chunks (tamaño objetivo: {chunk_size} palabras)")
    return chunks


def clean_text(text: str) -> str:
    """Limpia un texto removiendo espacios excesivos y caracteres especiales."""
    # Normalizar saltos de línea
    text = re.sub(r'\r\n', '\n', text)
    # Reemplazar múltiples saltos de línea con uno solo
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Reemplazar múltiples espacios con uno solo
    text = re.sub(r' {2,}', ' ', text)
    # Remover tabulaciones
    text = text.replace('\t', ' ')
    return text.strip()


def split_into_sentences(text: str) -> list[str]:
    """
    Divide texto en oraciones usando heurísticas.
    Maneja abreviaciones comunes en español.
    """
    # Preservar abreviaciones comunes
    abbreviations = ['Dr', 'Dra', 'Sr', 'Sra', 'Ing', 'Lic', 'Prof', 'etc', 'vs', 'p.ej']
    for abbr in abbreviations:
        text = text.replace(f'{abbr}.', f'{abbr}<<DOT>>')

    # Dividir por puntos, signos de interrogación y exclamación
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    # Restaurar abreviaciones
    sentences = [s.replace('<<DOT>>', '.') for s in sentences]
    
    # Filtrar oraciones vacías
    return [s.strip() for s in sentences if s.strip()]
