"""
AMY — Límite de peticiones (slowapi + Redis)

Compartido por main.py y los routers. Redis como almacenamiento hace que el límite
sea común a los 4 workers de Gunicorn.

La clave es la IP real del cliente: nginx envía X-Forwarded-For con $remote_addr
(sobrescribiéndolo, así el cliente no puede falsificarlo) y Gunicorn confía en ese
encabezado (--forwarded-allow-ips), por lo que request.client.host es la IP del
usuario y no la del contenedor de nginx.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)
