"""
AMY — Configuracion Central
Lectura de variables de entorno con Pydantic BaseSettings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuracion centralizada del backend AMY."""

    # ── Base de Datos ────────────────────────────
    POSTGRES_USER: str = "tutor_user"
    POSTGRES_PASSWORD: str = "tutor_secure_password_2024"
    POSTGRES_DB: str = "tutor_bd_upec"
    DB_HOST: str = "db"
    DB_PORT: int = 5432

    # ── Ollama (Motor de IA Local) ───────────────
    OLLAMA_HOST: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "mistral"

    # ── RAG ──────────────────────────────────────
    EMBEDDING_DIM: int = 4096
    RAG_TOP_K: int = 5
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # ── Autenticacion ────────────────────────────
    SECRET_KEY: str = "amy-upec-secret-key-change-in-production-2024"
    JWT_EXPIRE_MINUTES: int = 480
    GOOGLE_CLIENT_ID: str = ""

    # ── Caché (Redis) ────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"


    @property
    def db_url(self) -> str:
        """URL de conexion para asyncpg."""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.POSTGRES_DB}"
        )

    class Config:
        env_file = ".env"
        extra = "ignore"


# Instancia global de configuracion
settings = Settings()
