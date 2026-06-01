"""
AMY -- Router de Autenticacion
Registro, inicio de sesion y consulta de usuario autenticado.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.database.connection import db
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=4)
    nombre: str


class GoogleLoginRequest(BaseModel):
    credential: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    nombre: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ── Endpoints ────────────────────────────────────────────────


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Registra un nuevo usuario."""
    existing = await db.fetchrow(
        "SELECT id FROM usuarios WHERE email = $1", body.email
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya esta registrado.",
        )

    user_id = str(uuid.uuid4())
    hashed = hash_password(body.password)

    await db.execute(
        """INSERT INTO usuarios (id, email, password_hash, nombre)
           VALUES ($1, $2, $3, $4)""",
        user_id,
        body.email,
        hashed,
        body.nombre,
    )

    token = create_access_token({"sub": user_id})
    logger.info("Usuario registrado: %s", body.email)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=body.email, nombre=body.nombre),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """Inicia sesion con credenciales existentes."""
    row = await db.fetchrow(
        "SELECT id, email, nombre, password_hash FROM usuarios WHERE email = $1",
        body.email,
    )
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas.",
        )

    user_id = str(row["id"])
    token = create_access_token({"sub": user_id})
    logger.info("Inicio de sesion: %s", body.email)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=row["email"], nombre=row["nombre"]),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    """Retorna la informacion del usuario autenticado."""
    return UserOut(**current_user)


@router.get("/config")
async def get_auth_config():
    """Retorna la configuracion publica para la autenticacion."""
    return {"googleClientId": settings.GOOGLE_CLIENT_ID}


@router.post("/google-login", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest):
    """Inicia sesion o registra a un usuario mediante Google OAuth."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        nombre = idinfo.get("name", "Usuario de Google")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El token de Google no contiene un correo valido."
            )
            
        email_clean = email.strip().lower()

    except ValueError as e:
        logger.warning("Fallo la verificacion del token de Google: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token de Google invalido: {str(e)}"
        )
    except Exception as e:
        logger.error("Error inesperado verificando token de Google: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al verificar la identidad con Google."
        )

    row = await db.fetchrow(
        "SELECT id, email, nombre FROM usuarios WHERE email = $1",
        email_clean
    )

    if not row:
        user_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO usuarios (id, email, password_hash, nombre)
               VALUES ($1, $2, NULL, $3)""",
            user_id,
            email_clean,
            nombre
        )
        logger.info("Nuevo usuario registrado via Google: %s", email_clean)
        row = {"id": user_id, "email": email_clean, "nombre": nombre}
    else:
        logger.info("Usuario existente inicio sesion via Google: %s", email_clean)

    user_id = str(row["id"])
    token = create_access_token({"sub": user_id})
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=row["email"], nombre=row["nombre"])
    )

