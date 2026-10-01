"""
AMY — Cliente Groq API
Modelos disponibles verificados con la API key activa.
"""

import logging
import httpx
from app.core.api_keys import api_keys

logger = logging.getLogger(__name__)

# Modelos disponibles en esta cuenta Groq, en orden de preferencia
# Verificado el 2026-08-21 con la API key activa
GROQ_MODELS = [
    "qwen/qwen3.8-27b",       # Excelente en español — ultrarrápido (<100ms)
    "openai/gpt-oss-120b",    # Mayor capacidad — 120B con razonamiento
    "groq/compound",          # Modelo compuesto de Groq
    "groq/compound-mini",     # Más rápido — para respuestas cortas
]


class GroqClient:
    def __init__(self):
        self.base_url = "https://api.groq.com/openai/v1"

    def _api_key(self) -> str:
        key = api_keys.get("groq")
        if not key:
            raise ValueError("No se ha configurado GROQ_API_KEY.")
        return key

    async def validate_key(self, key: str) -> tuple[bool, str]:
        """Comprueba una API key contra Groq sin guardarla."""
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=8.0) as client:
                r = await client.get("/models", headers={"Authorization": f"Bearer {key}"})
        except Exception as e:
            return False, f"No se pudo contactar con Groq: {e}"
        if r.status_code == 200:
            return True, "Clave válida: Groq respondió correctamente."
        if r.status_code in (401, 403):
            return False, "Groq rechazó la clave (inválida, revocada o caducada)."
        return False, f"Groq respondió con un error inesperado ({r.status_code})."

    async def generate(self, prompt: str, system: str = "") -> str:
        api_key = self._api_key()
        headers = {"Authorization": f"Bearer {api_key}"}
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        last_error = None
        async with httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=httpx.Timeout(connect=8.0, read=45.0, write=8.0, pool=8.0)
        ) as client:
            for model in GROQ_MODELS:
                try:
                    response = await client.post(
                        "/chat/completions",
                        json={
                            "model": model,
                            "messages": messages,
                            "temperature": 0.3,
                            "max_tokens": 2048
                        }
                    )

                    if response.status_code == 404:
                        logger.warning("Groq modelo %s: no encontrado (404). Probando siguiente...", model)
                        last_error = RuntimeError(f"Modelo {model} no encontrado.")
                        continue

                    if response.status_code in (429, 400, 401, 403):
                        logger.warning("Groq %s: error %d: %s", model, response.status_code, response.text[:100])
                        raise RuntimeError(f"Error {response.status_code} en Groq ({model}).")

                    response.raise_for_status()
                    result = response.json()["choices"][0]["message"]["content"]
                    logger.info("Groq %s respondio exitosamente (%d chars)", model, len(result))
                    return result

                except RuntimeError:
                    raise
                except Exception as e:
                    logger.warning("Groq %s: error inesperado: %s", model, e)
                    last_error = e
                    continue

        raise RuntimeError(f"Todos los modelos Groq fallaron. Ultimo error: {last_error}")

    async def is_healthy(self) -> bool:
        try:
            api_key = self._api_key()
            async with httpx.AsyncClient(
                base_url=self.base_url,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5.0
            ) as client:
                r = await client.get("/models")
                return r.status_code == 200
        except Exception:
            return False


groq_client = GroqClient()