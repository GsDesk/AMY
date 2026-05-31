# Backend: FastAPI + RAG Pipeline
FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema para asyncpg
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

EXPOSE 8000

# Servidor de producción: Gunicorn con trabajadores Uvicorn asíncronos (4 workers)
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "300", "--keep-alive", "5", "--graceful-timeout", "30"]



