"""
AMY — Almacén de API Keys de proveedores de IA (Groq, Gemini)
Permite renovar las claves desde el panel admin sin reiniciar el backend.

- Las claves se guardan cifradas (Fernet, derivado de SECRET_KEY) en la tabla configuracion_api.
- Cada worker de Gunicorn mantiene una caché en memoria que se recarga periódicamente,
  de modo que una clave guardada desde el panel se propaga a todos los workers.
- Si no hay clave guardada desde el panel, se usa la del archivo .env.
"""

import asyncio
import base64
import hashlib
import logging
from datetime import datetime

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.database.connection import db

logger = logging.getLogger(__name__)

PROVIDERS = {
    "groq": {"label": "Groq", "env_attr": "GROQ_API_KEY"},
    "gemini": {"label": "Google Gemini", "env_attr": "GEMINI_API_KEY"},
}

REFRESH_SECONDS = 10


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def mask_key(key: str) -> str:
    """Muestra solo el prefijo y los últimos 4 caracteres de la clave."""
    if not key:
        return ""
    if len(key) <= 10:
        return "•" * len(key)
    return f"{key[:4]}{'•' * 8}{key[-4:]}"


class ApiKeyStore:
    def __init__(self):
        # provider -> {"key": str, "updated_at": datetime, "updated_by": str}
        self._cache: dict[str, dict] = {}
        self._task: asyncio.Task | None = None

    async def refresh(self):
        """Recarga desde la BD las claves guardadas desde el panel."""
        try:
            rows = await db.fetch(
                "SELECT proveedor, valor_cifrado, actualizado_en, actualizado_por FROM configuracion_api"
            )
        except Exception as e:
            logger.warning("No se pudieron cargar las API keys del panel: %s", e)
            return

        fernet = _fernet()
        cache = {}
        for r in rows:
            try:
                key = fernet.decrypt(r["valor_cifrado"].encode("utf-8")).decode("utf-8")
            except InvalidToken:
                logger.warning("API key de %s no se puede descifrar (¿cambió SECRET_KEY?). Se ignora.", r["proveedor"])
                continue
            cache[r["proveedor"]] = {
                "key": key,
                "updated_at": r["actualizado_en"],
                "updated_by": r["actualizado_por"],
            }
        self._cache = cache

    async def _refresh_loop(self):
        while True:
            await asyncio.sleep(REFRESH_SECONDS)
            await self.refresh()

    async def start(self):
        await self.refresh()
        self._task = asyncio.create_task(self._refresh_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()

    def get(self, provider: str) -> str:
        """Clave activa: la del panel si existe, si no la del .env."""
        panel = self._cache.get(provider)
        if panel and panel["key"]:
            return panel["key"]
        return (getattr(settings, PROVIDERS[provider]["env_attr"], "") or "").strip()

    def describe(self, provider: str) -> dict:
        """Información segura (sin la clave completa) para el panel admin."""
        panel = self._cache.get(provider)
        env_key = (getattr(settings, PROVIDERS[provider]["env_attr"], "") or "").strip()
        active = self.get(provider)
        if panel:
            source = "panel"
        elif env_key:
            source = "env"
        else:
            source = "none"
        updated_at: datetime | None = panel["updated_at"] if panel else None
        return {
            "provider": provider,
            "label": PROVIDERS[provider]["label"],
            "configured": bool(active),
            "source": source,
            "masked": mask_key(active),
            "hasEnvFallback": bool(env_key),
            "updatedAt": updated_at.isoformat() if updated_at else None,
            "updatedBy": panel["updated_by"] if panel else None,
        }

    async def save(self, provider: str, key: str, admin_email: str):
        token = _fernet().encrypt(key.encode("utf-8")).decode("utf-8")
        await db.execute(
            """INSERT INTO configuracion_api (proveedor, valor_cifrado, actualizado_en, actualizado_por)
               VALUES ($1, $2, NOW(), $3)
               ON CONFLICT (proveedor) DO UPDATE
               SET valor_cifrado = EXCLUDED.valor_cifrado,
                   actualizado_en = EXCLUDED.actualizado_en,
                   actualizado_por = EXCLUDED.actualizado_por""",
            provider, token, admin_email,
        )
        await self.refresh()

    async def clear(self, provider: str):
        await db.execute("DELETE FROM configuracion_api WHERE proveedor = $1", provider)
        await self.refresh()


api_keys = ApiKeyStore()
