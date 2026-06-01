"""
AMY — Conexion a Base de Datos
Pool de conexiones asincronas con asyncpg para PostgreSQL + pgvector.
"""

import asyncpg
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class Database:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        try:
            self.pool = await asyncpg.create_pool(
                dsn=settings.db_url, min_size=2, max_size=10, command_timeout=30
            )
            logger.info(f"Conectado a PostgreSQL: {settings.DB_HOST}:{settings.DB_PORT}/{settings.POSTGRES_DB}")
        except Exception as e:
            logger.error(f"Error conectando a PostgreSQL: {e}")
            raise

    async def init_tables(self):
        """
        Crea todas las tablas del sistema si no existen.
        Se ejecuta en cada arranque del backend como garantia de consistencia,
        sin importar si el volumen de PostgreSQL fue reiniciado o es nuevo.
        """
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS usuarios (
                    id VARCHAR(100) PRIMARY KEY,
                    email VARCHAR(150) UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    nombre VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversaciones (
                    id VARCHAR(100) PRIMARY KEY,
                    usuario_id VARCHAR(100) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    titulo VARCHAR(200) NOT NULL DEFAULT 'Nueva conversacion',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS mensajes (
                    id VARCHAR(100) PRIMARY KEY,
                    conversacion_id VARCHAR(100) NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
                    sender VARCHAR(50) NOT NULL CHECK (sender IN ('user', 'tutor')),
                    content TEXT NOT NULL,
                    topic VARCHAR(100),
                    source VARCHAR(50),
                    rag_used BOOLEAN DEFAULT FALSE,
                    live_example TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fragmentos_conocimiento (
                    id_fragmento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    categoria VARCHAR(100) NOT NULL,
                    contenido TEXT NOT NULL,
                    metadata JSONB DEFAULT '{}',
                    embedding vector(4096),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            # Quitar restriccion NOT NULL en password_hash para soportar OAuth
            await conn.execute("ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;")

        logger.info("Tablas del sistema verificadas y listas")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            logger.info("Desconectado de PostgreSQL")

    async def fetch(self, query: str, *args) -> list:
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args) -> str:
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def is_healthy(self) -> bool:
        try:
            return await self.fetchval("SELECT 1") == 1
        except Exception:
            return False


db = Database()
