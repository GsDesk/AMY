"""
AMY -- Router de Autenticacion
Registro, inicio de sesion (correo/contraseña y Google) y recuperación de contraseña.
"""

import logging
import re
import secrets
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.core import mailer
from app.core.rate_limit import limiter
from app.database.connection import db
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# bcrypt solo procesa los primeros 72 bytes: se limita para que dos contraseñas
# distintas con el mismo prefijo no sean equivalentes
MAX_PASSWORD_BYTES = 72
MAX_RESET_ATTEMPTS = 5
RESET_CODE_MINUTES = 15
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(raw: str) -> str:
    """Correo en minúsculas y sin espacios; así 'Ana@X.com' y 'ana@x.com' son la misma cuenta."""
    email = (raw or "").strip().lower()
    if not _EMAIL_RE.match(email) or len(email) > 150:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Correo electrónico no válido.")
    return email


def _check_password(password: str) -> None:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña es demasiado larga (máximo 72 caracteres).",
        )


# ── Schemas ──────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=150)
    password: str = Field(..., min_length=8)
    nombre: str = Field(..., min_length=1, max_length=100)


class GoogleLoginRequest(BaseModel):
    credential: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=150)


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., max_length=150)
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=150)
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    nombre: str
    rol: str = "estudiante"


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ── Endpoints ────────────────────────────────────────────────


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    """Registra un nuevo usuario."""
    email = _normalize_email(body.email)
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre es obligatorio.")
    _check_password(body.password)

    existing = await db.fetchrow("SELECT id FROM usuarios WHERE email = $1", email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya esta registrado.",
        )

    # Si es el primer usuario registrado en la plataforma, asignarle rol de admin
    total_users = await db.fetchval("SELECT COUNT(*) FROM usuarios") or 0
    assigned_role = "admin" if total_users == 0 else "estudiante"

    user_id = str(uuid.uuid4())
    hashed = hash_password(body.password)

    await db.execute(
        """INSERT INTO usuarios (id, email, password_hash, nombre, rol)
           VALUES ($1, $2, $3, $4, $5)""",
        user_id,
        email,
        hashed,
        nombre,
        assigned_role,
    )

    token = create_access_token({"sub": user_id, "rol": assigned_role})
    logger.info("Usuario registrado: %s (rol=%s)", email, assigned_role)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=email, nombre=nombre, rol=assigned_role),
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest):
    """Inicia sesion con credenciales existentes."""
    email = (body.email or "").strip().lower()
    row = await db.fetchrow(
        "SELECT id, email, nombre, password_hash, rol FROM usuarios WHERE email = $1",
        email,
    )
    # Las cuentas creadas con Google no tienen contraseña: misma respuesta que una
    # credencial incorrecta (antes provocaba un error 500 que revelaba la cuenta)
    password_ok = (
        row is not None
        and row["password_hash"]
        and len(body.password.encode("utf-8")) <= MAX_PASSWORD_BYTES
        and verify_password(body.password, row["password_hash"])
    )
    if not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas.",
        )

    user_id = str(row["id"])
    user_role = row.get("rol", "estudiante")
    token = create_access_token({"sub": user_id, "rol": user_role})
    logger.info("Inicio de sesion: %s (rol=%s)", email, user_role)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=row["email"], nombre=row["nombre"], rol=user_role),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    """Retorna la informacion del usuario autenticado."""
    return UserOut(**current_user)


@router.get("/config")
async def get_auth_config():
    """Retorna la configuracion publica para la autenticacion."""
    return {"googleClientId": getattr(settings, "GOOGLE_CLIENT_ID", "")}


@router.post("/google-login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleLoginRequest):
    """Inicia sesión o registra un usuario mediante Google OAuth 2.0 (ID Token)."""
    credential = body.credential.strip()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La credencial de Google no puede estar vacía."
        )

    google_client_id = (getattr(settings, "GOOGLE_CLIENT_ID", "") or "").strip()
    if not google_client_id:
        # Sin audiencia configurada se aceptarían tokens emitidos para cualquier otra aplicación
        logger.error("Login con Google rechazado: GOOGLE_CLIENT_ID no está configurado")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El inicio de sesión con Google no está disponible.",
        )

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        # Verificar criptográficamente la firma del token con las claves públicas de Google
        payload = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            audience=google_client_id
        )

        # Validar emisor oficial de Google
        if payload.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Emisor del token de Google no válido.")
    except Exception as e:
        logger.error("Error verificando token de Google: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación de Google inválido, alterado o expirado."
        )

    email = (payload.get("email") or "").strip().lower()
    nombre = (payload.get("name") or payload.get("given_name") or (email.split("@")[0] if email else "Usuario Google"))[:100]

    if not email or payload.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta de Google no contiene un correo electrónico verificado."
        )

    row = await db.fetchrow(
        "SELECT id, email, nombre, rol, password_hash FROM usuarios WHERE email = $1",
        email
    )

    if not row:
        total_users = await db.fetchval("SELECT COUNT(*) FROM usuarios") or 0
        assigned_role = "admin" if total_users == 0 else "estudiante"
        user_id = str(uuid.uuid4())

        await db.execute(
            """INSERT INTO usuarios (id, email, password_hash, nombre, rol)
               VALUES ($1, $2, NULL, $3, $4)""",
            user_id,
            email,
            nombre,
            assigned_role
        )
        final_role = assigned_role
        logger.info("Nuevo usuario registrado vía Google: %s (rol=%s)", email, final_role)
    else:
        user_id = str(row["id"])
        final_role = row.get("rol", "estudiante")
        if row["password_hash"]:
            # Google acaba de demostrar que esta persona es dueña del correo. La contraseña
            # existente pudo crearla otra persona sin verificar el correo (secuestro previo
            # de cuenta): se anula; el usuario puede crear una nueva con "Olvidé mi contraseña".
            await db.execute("UPDATE usuarios SET password_hash = NULL WHERE id = $1", user_id)
            logger.warning("Contraseña previa anulada al vincular Google con %s", email)
        logger.info("Usuario inició sesión vía Google: %s (rol=%s)", email, final_role)

    jwt_token = create_access_token({"sub": user_id, "rol": final_role})
    return AuthResponse(
        token=jwt_token,
        user=UserOut(id=user_id, email=email, nombre=nombre, rol=final_role)
    )


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, background: BackgroundTasks):
    """Genera un código temporal de 6 dígitos y lo envía por correo."""
    email = (body.email or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes ingresar un correo electrónico."
        )

    standard = {
        "success": True,
        "message": "Si tu correo está registrado, recibirás un código de recuperación."
    }

    row = await db.fetchrow("SELECT id FROM usuarios WHERE email = $1", email)
    if not row:
        # Por seguridad no filtrar si existe o no, respondiendo mensaje estándar
        return standard

    # Código numérico de 6 dígitos criptográficamente seguro; un código nuevo reinicia los intentos
    code = f"{secrets.randbelow(900000) + 100000}"
    await db.execute(
        """INSERT INTO codigos_recuperacion (email, codigo, expira_en, intentos)
           VALUES ($1, $2, NOW() + make_interval(mins => $3), 0)
           ON CONFLICT (email) DO UPDATE
           SET codigo = $2, expira_en = NOW() + make_interval(mins => $3), intentos = 0""",
        email,
        code,
        RESET_CODE_MINUTES,
    )

    # El envío va en segundo plano: así el tiempo de respuesta es el mismo exista o no
    # la cuenta, y un SMTP lento o caído no bloquea la petición
    background.add_task(mailer.send_reset_code, email, code, RESET_CODE_MINUTES)
    logger.info("Código de recuperación generado para %s", email)
    return standard


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, body: ResetPasswordRequest):
    """Valida el código de recuperación de 6 dígitos y actualiza la contraseña."""
    email = (body.email or "").strip().lower()
    code = body.code.strip()
    _check_password(body.new_password)

    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El código de recuperación es incorrecto o ha expirado. Solicita un nuevo código."
    )

    row = await db.fetchrow(
        """SELECT codigo, intentos FROM codigos_recuperacion
           WHERE email = $1 AND expira_en > NOW()""",
        email,
    )
    if not row:
        raise invalid

    # Tras MAX_RESET_ATTEMPTS fallos el código se invalida: probar los 900 000 códigos
    # posibles deja de ser viable aunque se repartan las peticiones entre varias IPs
    if row["intentos"] >= MAX_RESET_ATTEMPTS:
        await db.execute("DELETE FROM codigos_recuperacion WHERE email = $1", email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demasiados intentos fallidos. Solicita un nuevo código."
        )

    if not secrets.compare_digest(row["codigo"], code):
        await db.execute(
            "UPDATE codigos_recuperacion SET intentos = intentos + 1 WHERE email = $1",
            email,
        )
        raise invalid

    hashed = hash_password(body.new_password)
    updated = await db.execute(
        "UPDATE usuarios SET password_hash = $1 WHERE email = $2",
        hashed,
        email
    )
    # Un código solo sirve una vez
    await db.execute("DELETE FROM codigos_recuperacion WHERE email = $1", email)

    if updated == "UPDATE 0":
        raise invalid

    logger.info("Contraseña restablecida exitosamente para: %s", email)
    return {
        "success": True,
        "message": "Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión."
    }
