"""
AMY — Cliente Google Gemini API (gemini-2.0-flash / gemini-1.5-pro)
Ultrarrápido (~0.5-1s), gratuito con Google AI Studio API Key.
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# Modelos en orden de preferencia (más rápido primero)
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiClient:
    def __init__(self):
        self.timeout = httpx.Timeout(connect=6.0, read=40.0, write=6.0, pool=6.0)

    def _api_key(self) -> str:
        key = (settings.GEMINI_API_KEY or "").strip()
        if not key:
            raise ValueError("GEMINI_API_KEY no esta configurada en .env")
        return key

    async def generate(self, prompt: str, system: str = "") -> str:
        api_key = self._api_key()

        # Construir el contenido: system instruction + user message
        parts_user = [{"text": prompt}]
        request_body = {
            "contents": [{"role": "user", "parts": parts_user}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1200,
                "topP": 0.95,
            },
        }
        if system:
            request_body["systemInstruction"] = {
                "parts": [{"text": system}]
            }

        # Intentar modelos en orden
        last_error = None
        for model in GEMINI_MODELS:
            url = f"{GEMINI_API_BASE}/{model}:generateContent?key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
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

                    # Extraer texto de la respuesta
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

    async def is_healthy(self) -> bool:
        try:
            api_key = self._api_key()
            url = f"{GEMINI_API_BASE}/gemini-2.0-flash?key={api_key}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(url)
                return r.status_code in (200, 400)  # 400 = key valid but bad request
        except Exception:
            return False


gemini_client = GeminiClient()
