# Database: PostgreSQL + pgvector
FROM ankane/pgvector:latest

# Copiar scripts de inicialización
# PostgreSQL ejecuta automáticamente los archivos en /docker-entrypoint-initdb.d/
COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
