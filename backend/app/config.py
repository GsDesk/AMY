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
    EMBEDDING_DIM: int = 768
    RAG_TOP_K: int = 5
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # ── Autenticacion ────────────────────────────
    SECRET_KEY: str = "amy-upec-secret-key-change-in-production-2024"
    JWT_EXPIRE_MINUTES: int = 480
    # ── Autenticación Microsoft UPEC ─────────────
    AZURE_CLIENT_ID: str = "b70d884c-ba19-48f3-ac91-a1e24f14e544"
    AZURE_TENANT_ID: str = "0a42bec9-732b-45d1-977d-3b8d3ac98c2b"
    AZURE_CLIENT_SECRET: str = ""

    # ── Caché (Redis) ────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"


    # ── Groq API ─────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

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
