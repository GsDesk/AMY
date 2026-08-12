"""
AMY — Cliente Groq API (Ultrarrápido Llama 3.3 70B)
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class GroqClient:
    def __init__(self):
        self.model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self.base_url = "https://api.groq.com/openai/v1"

    async def generate(self, prompt: str, system: str = "") -> str:
        api_key = settings.GROQ_API_KEY.strip() if settings.GROQ_API_KEY else ""
        if not api_key:
            raise ValueError("No se ha configurado GROQ_API_KEY.")

        headers = {"Authorization": f"Bearer {api_key}"}
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=httpx.Timeout(connect=8.0, read=45.0, write=8.0, pool=8.0)
        ) as client:
            response = await client.post(
                "/chat/completions",
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 700
                }
            )

            if response.status_code in (429, 400, 401, 403):
                logger.warning("Groq API retornó %d (límite de tokens/cuota): %s", response.status_code, response.text)
                raise RuntimeError(f"Límite de tokens o cuota alcanzado en Groq ({response.status_code}).")

            response.raise_for_status()
            result = response.json()["choices"][0]["message"]["content"]
            logger.info("Groq respondio exitosamente (%d caracteres)", len(result))
            return result

    async def is_healthy(self) -> bool:
        api_key = settings.GROQ_API_KEY.strip() if settings.GROQ_API_KEY else ""
        if not api_key:
            return False
        try:
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