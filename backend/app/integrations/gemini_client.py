"""
AMY — Cliente Google Gemini API (gemini-2.5-flash / gemini-2.5-pro)
Ultrarrápido (~0.5-1s), gratuito con Google AI Studio API Key (AIzaSy...).
Soporta generación completa y streaming SSE.
"""

import logging
import json
import httpx
from typing import AsyncIterator
from app.config import settings

logger = logging.getLogger(__name__)

# Modelos disponibles en orden de preferencia (más rápido y estable primero)
# Verificado con la API v1beta de Google AI Studio el 2026-08-21
GEMINI_MODELS = [
    "gemini-flash-lite-latest",   # Funciona — alias ligero siempre disponible
    "gemini-flash-latest",        # Funciona — alias genérico
    "gemini-2.5-flash-lite",      # Fallback — puede no estar disponible
    "gemini-3.6-flash",           # Fallback — tiende a timeout en free tier
]

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiClient:
    def __init__(self):
        self._timeout = httpx.Timeout(connect=3.0, read=8.0, write=3.0, pool=3.0)

        # Cliente persistente para reutilizar conexiones TCP (más rápido en requests repetidos)
        self._client: httpx.AsyncClient | None = None

    def _api_key(self) -> str:
        key = (settings.GEMINI_API_KEY or "").strip()
        if not key:
            raise ValueError("GEMINI_API_KEY no esta configurada en .env")
        return key

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    def _build_body(self, prompt: str, system: str = "", attachment: dict | None = None) -> dict:
        parts = []
        if attachment and attachment.get("base64_data") and attachment.get("mime_type"):
            base64_str = attachment["base64_data"]
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]

            parts.append({
                "inlineData": {
                    "mimeType": attachment["mime_type"],
                    "data": base64_str
                }
            })

        parts.append({"text": prompt or "Analiza el archivo o imagen adjunta."})

        body = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 2048,
                "topP": 0.95,
            },
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        return body

    async def generate(self, prompt: str, system: str = "", attachment: dict | None = None) -> str:
        """Generación completa (sin streaming). Retorna el texto completo."""
        api_key = self._api_key()
        request_body = self._build_body(prompt, system, attachment)
        client = self._get_client()

        last_error = None
        for model in GEMINI_MODELS:
            url = f"{GEMINI_API_BASE}/{model}:generateContent?key={api_key}"
            try:
                response = await client.post(url, json=request_body)

                if response.status_code == 429:
                    logger.warning("Gemini %s: rate limit (429). Probando siguiente modelo...", model)
                    last_error = RuntimeError(f"Rate limit en modelo {model}")
                    continue

                if response.status_code in (400, 404):
                    logger.warning("Gemini %s: error %d. Probando siguiente modelo...", model, response.status_code)
                    last_error = RuntimeError(f"Error {response.status_code} en modelo {model}")
                    continue

                response.raise_for_status()
                data = response.json()

                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "")
                        logger.info("Gemini %s respondio exitosamente (%d chars)", model, len(text))
                        return text

                raise RuntimeError(f"Respuesta vacia de Gemini {model}: {data}")

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                logger.warning("Gemini %s: timeout/conexion (%s). Probando siguiente modelo...", model, e)
                last_error = e
                continue
            except RuntimeError:
                raise
            except Exception as e:
                logger.warning("Gemini %s: error inesperado (%s).", model, e)
                last_error = e
                continue

        raise RuntimeError(f"Todos los modelos Gemini fallaron. Ultimo error: {last_error}")

    async def stream(self, prompt: str, system: str = "", attachment: dict | None = None) -> AsyncIterator[str]:
        """Streaming SSE — emite tokens mientras se generan."""
        api_key = self._api_key()
        request_body = self._build_body(prompt, system, attachment)

        last_error = None
        for model in GEMINI_MODELS:
            url = f"{GEMINI_API_BASE}/{model}:streamGenerateContent?alt=sse&key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    async with client.stream("POST", url, json=request_body) as response:
                        if response.status_code == 429:
                            logger.warning("Gemini stream %s: rate limit (429).", model)
                            last_error = RuntimeError(f"Rate limit en modelo {model}")
                            continue
                        if response.status_code in (400, 404):
                            logger.warning("Gemini stream %s: error %d.", model, response.status_code)
                            last_error = RuntimeError(f"Error {response.status_code} en modelo {model}")
                            continue

                        response.raise_for_status()
                        logger.info("Gemini stream %s: iniciado", model)

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                raw = line[6:].strip()
                                if raw == "[DONE]":
                                    return
                                try:
                                    chunk = json.loads(raw)
                                    candidates = chunk.get("candidates", [])
                                    if candidates:
                                        parts = candidates[0].get("content", {}).get("parts", [])
                                        for part in parts:
                                            token = part.get("text", "")
                                            if token:
                                                yield token
                                except (json.JSONDecodeError, KeyError):
                                    continue
                        return  # stream completo sin error

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                logger.warning("Gemini stream %s: timeout (%s).", model, e)
                last_error = e
                continue
            except RuntimeError:
                raise
            except Exception as e:
                logger.warning("Gemini stream %s: error inesperado (%s).", model, e)
                last_error = e
                continue

        raise RuntimeError(f"Todos los modelos Gemini stream fallaron. Ultimo: {last_error}")

    async def is_healthy(self) -> bool:
        try:
            api_key = self._api_key()
            url = f"{GEMINI_API_BASE}/gemini-2.5-flash?key={api_key}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(url)
                return r.status_code in (200, 400)
        except Exception:
            return False

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


gemini_client = GeminiClient()

