# Backend: FastAPI + RAG Pipeline
FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema para asyncpg
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Crear usuario y grupo no privilegiado
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/sh -m appuser

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente asignando propiedad al usuario no privilegiado
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

# Servidor de producción: Gunicorn con trabajadores Uvicorn asíncronos (4 workers)
# --forwarded-allow-ips: confía en X-Forwarded-For para conocer la IP real del cliente.
# Es seguro porque el puerto 8000 no se publica: solo nginx (red interna de Docker) llega
# al backend, y nginx sobrescribe ese encabezado con la IP de la conexión.
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--forwarded-allow-ips", "*", "--timeout", "300", "--keep-alive", "5", "--graceful-timeout", "30"]



