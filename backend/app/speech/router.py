"""
AMY -- Dictado por voz
Transcribe el audio del micrófono con Whisper (Groq). Se usa cuando el navegador no
tiene reconocimiento de voz propio que funcione (Brave, Opera, Firefox, Chromium...).
"""

import logging

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.auth.dependencies import get_current_user
from app.core.api_keys import api_keys
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/speech", tags=["speech"])

GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
WHISPER_MODEL = "whisper-large-v3-turbo"
MAX_AUDIO_BYTES = 8 * 1024 * 1024  # ~4 min de audio opus
# Orienta a Whisper con el vocabulario de la materia (mejora términos como "foránea" o "BCNF")
DOMAIN_PROMPT = (
    "Pregunta de un estudiante sobre bases de datos: SQL, consultas, JOIN, clave primaria, "
    "clave foránea, normalización, BCNF, modelo entidad-relación, transacciones, índices."
)


@router.post("/transcribe")
@limiter.limit("40/minute")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    key = api_keys.get("groq")
    if not key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El dictado por voz no está configurado (falta la API key de Groq).")

    data = await audio.read()
    if not data:
        return {"text": ""}
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "El audio es demasiado largo.")

    content_type = (audio.content_type or "audio/webm").split(";")[0]
    ext = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav"}.get(content_type, "webm")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GROQ_TRANSCRIBE_URL,
                headers={"Authorization": f"Bearer {key}"},
                files={"file": (f"dictado.{ext}", data, content_type)},
                data={
                    "model": WHISPER_MODEL,
                    "language": "es",
                    "response_format": "json",
                    "temperature": "0",
                    "prompt": DOMAIN_PROMPT,
                },
            )
    except httpx.HTTPError as e:
        logger.error("Error de red al transcribir audio: %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No se pudo transcribir el audio.")

    if resp.status_code == 429:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiadas transcripciones seguidas. Espera unos segundos.")
    if resp.status_code != 200:
        logger.error("Groq Whisper respondió %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No se pudo transcribir el audio.")

    return {"text": (resp.json().get("text") or "").strip()}
