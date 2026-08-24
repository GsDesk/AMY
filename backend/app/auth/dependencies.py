"""
AMY -- Dependencias de Autenticacion
FastAPI dependencies para proteger endpoints.
"""

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.auth.security import decode_token
from app.database.connection import db

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """Extrae y valida el token Bearer, retorna los datos del usuario."""
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalido: identificador de usuario ausente.",
            )
    except JWTError as e:
        logger.warning("Token JWT invalido o expirado: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado.",
        )

    row = await db.fetchrow(
        "SELECT id, email, nombre, rol FROM usuarios WHERE id = $1",
        user_id,
    )
    if row is None:
        logger.warning("Usuario con id=%s no encontrado en la base de datos", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        )

    return {
        "id": str(row["id"]),
        "email": row["email"],
        "nombre": row["nombre"],
        "rol": row.get("rol", "estudiante"),
    }


async def get_current_admin_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Verifica que el usuario autenticado posee rol de administrador."""
    if current_user.get("rol") != "admin":
        logger.warning(
            "Acceso denegado a zona admin para usuario: %s (rol=%s)",
            current_user.get("email"),
            current_user.get("rol"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a administradores y docentes.",
        )
    return current_user

