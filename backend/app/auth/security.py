"""
AMY -- Seguridad y Autenticacion
Hashing de contrasenas y generacion/verificacion de tokens JWT.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
import bcrypt

from app.config import settings

def verify_password(plain: str, hashed: str) -> bool:
    """Verifica una contrasena plana contra su hash bcrypt."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(password: str) -> str:
    """Genera un hash bcrypt de la contrasena."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")



def create_access_token(data: dict) -> str:
    """Crea un JWT firmado con expiracion configurable."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decodifica y valida un JWT. Lanza JWTError si es invalido o expirado."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        raise
