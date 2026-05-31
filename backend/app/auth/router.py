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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=4)
    nombre: str


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
