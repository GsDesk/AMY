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
    SIMILARITY_THRESHOLD: float = 0.55

    # ── Autenticacion ────────────────────────────
    SECRET_KEY: str
    JWT_EXPIRE_MINUTES: int = 480

    # ── Caché (Redis) ────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"


    # ── Groq API ─────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Google Gemini API ────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GOOGLE_CLIENT_ID: str = ""

    # ── Correo (SMTP) ────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""            # Si se deja vacío se usa SMTP_USER
    SMTP_FROM_NAME: str = "AMY Tutor UPEC"
    SMTP_SECURITY: str = "starttls"  # starttls (587) | ssl (465) | none
    SMTP_TIMEOUT: int = 15

    # ── Seguridad & CORS ─────────────────────────
    ALLOWED_ORIGINS: str

    @property
    def allowed_origins_list(self) -> list[str]:
        """Retorna la lista de orígenes permitidos para CORS."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def smtp_sender(self) -> str:
        return self.SMTP_FROM or self.SMTP_USER


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
