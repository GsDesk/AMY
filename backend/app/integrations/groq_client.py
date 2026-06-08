"""AMY Cliente Groq"""
import httpx, logging
from app.config import settings
logger = logging.getLogger(__name__)
class GroqClient:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.GROQ_MODEL
        self.base_url = "https://api.groq.com/openai/v1"
        self.client = httpx.AsyncClient(base_url=self.base_url, headers={"Authorization": f"Bearer {self.api_key}"}, timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0))
    async def generate(self, prompt: str, system: str = "") -> str:
        try:
            messages = []
            if system: messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            response = await self.client.post("/chat/completions", json={"model": self.model, "messages": messages, "temperature": 0.7, "max_tokens": 1024})
            response.raise_for_status()
            result = response.json()["choices"][0]["message"]["content"]
            logger.info(f"Groq: {len(result)} chars")
            return result
        except Exception as e:
            logger.error(f"Error Groq: {e}")
            raise
    async def is_healthy(self) -> bool:
        try:
            r = await self.client.get("/models")
            return r.status_code == 200
        except: return False
    async def close(self): await self.client.aclose()
groq_client = GroqClient()