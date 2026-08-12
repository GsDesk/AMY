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
    password: str = Field(..., min_length=8)
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
    rol: str = "estudiante"


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

    # Si es el primer usuario registrado en la plataforma, asignarle rol de admin
    total_users = await db.fetchval("SELECT COUNT(*) FROM usuarios") or 0
    assigned_role = "admin" if total_users == 0 else "estudiante"

    user_id = str(uuid.uuid4())
    hashed = hash_password(body.password)

    await db.execute(
        """INSERT INTO usuarios (id, email, password_hash, nombre, rol)
           VALUES ($1, $2, $3, $4, $5)""",
        user_id,
        body.email,
        hashed,
        body.nombre,
        assigned_role,
    )

    token = create_access_token({"sub": user_id, "rol": assigned_role})
    logger.info("Usuario registrado: %s (rol=%s)", body.email, assigned_role)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=body.email, nombre=body.nombre, rol=assigned_role),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """Inicia sesion con credenciales existentes."""
    row = await db.fetchrow(
        "SELECT id, email, nombre, password_hash, rol FROM usuarios WHERE email = $1",
        body.email,
    )
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas.",
        )

    user_id = str(row["id"])
    user_role = row.get("rol", "estudiante")
    token = create_access_token({"sub": user_id, "rol": user_role})
    logger.info("Inicio de sesion: %s (rol=%s)", body.email, user_role)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=row["email"], nombre=row["nombre"], rol=user_role),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    """Retorna la informacion del usuario autenticado."""
    return UserOut(**current_user)


class MicrosoftLoginRequest(BaseModel):
    accessToken: str


@router.get("/config")
async def get_auth_config():
    """Retorna la configuracion publica para la autenticacion."""
    return {
        "googleClientId": settings.GOOGLE_CLIENT_ID,
        "azureClientId": settings.AZURE_CLIENT_ID,
        "azureTenantId": settings.AZURE_TENANT_ID,
    }


@router.post("/microsoft-login", response_model=AuthResponse)
async def microsoft_login(body: MicrosoftLoginRequest):
    """
    Inicia sesion o registra un usuario institucional de la UPEC mediante Microsoft 365 OAuth 2.0.
    Discrimina automáticamente entre Docentes (rol 'admin') y Estudiantes (rol 'estudiante').
    """
    import httpx

    access_token = body.accessToken.strip()
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El token de acceso de Microsoft no puede estar vacío."
        )

    headers = {"Authorization": f"Bearer {access_token}"}

    # 1. Obtener perfil del usuario desde Microsoft Graph API
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            me_resp = await client.get(
                "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department",
                headers=headers
            )
            if me_resp.status_code != 200:
                logger.warning("Fallo al consultar Microsoft Graph API: %d - %s", me_resp.status_code, me_resp.text)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No se pudo verificar la identidad con Microsoft 365. El token expiró o es inválido."
                )
            user_data = me_resp.json()

            # 2. Consultar grupos a los que pertenece en Entra ID
            groups_list = []
            try:
                groups_resp = await client.get("https://graph.microsoft.com/v1.0/me/memberOf", headers=headers)
                if groups_resp.status_code == 200:
                    groups_list = groups_resp.json().get("value", [])
            except Exception as ge:
                logger.warning("No se pudieron consultar los grupos de Microsoft: %s", ge)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al conectar con Microsoft Graph API: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error al comunicarse con los servicios de autenticación de Microsoft."
        )

    # 3. Extraer datos principales
    email = (user_data.get("mail") or user_data.get("userPrincipalName") or "").strip().lower()
    nombre = user_data.get("displayName") or email.split("@")[0]
    job_title = (user_data.get("jobTitle") or "").lower()
    department = (user_data.get("department") or "").lower()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta de Microsoft no tiene un correo electrónico configurado."
        )

    # 4. Validación de Dominio Institucional (@upec.edu.ec)
    if not email.endswith("@upec.edu.ec"):
        logger.warning("Intento de login institucional denegado para correo no UPEC: %s", email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo se permiten cuentas institucionales de la UPEC (@upec.edu.ec)."
        )

    # 5. Evaluación Automática de Rol (Docentes -> admin, Estudiantes -> estudiante)
    is_docente = False

    # Verificar jobTitle o department
    for term in ("docente", "profesor", "catedratico", "profesora"):
        if term in job_title or term in department:
            is_docente = True
            break

    # Verificar grupos de Microsoft Entra ID
    if not is_docente:
        for g in groups_list:
            g_name = (g.get("displayName") or "").lower()
            if any(term in g_name for term in ("docentes", "profesores", "docente", "profesor")):
                is_docente = True
                break

    evaluated_role = "admin" if is_docente else "estudiante"

    # 6. Persistencia en PostgreSQL
    row = await db.fetchrow(
        "SELECT id, email, nombre, rol FROM usuarios WHERE email = $1",
        email
    )

    if not row:
        user_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO usuarios (id, email, password_hash, nombre, rol)
               VALUES ($1, $2, NULL, $3, $4)""",
            user_id,
            email,
            nombre,
            evaluated_role
        )
        logger.info("Nuevo usuario UPEC registrado vía Microsoft: %s (rol=%s)", email, evaluated_role)
        final_role = evaluated_role
    else:
        user_id = str(row["id"])
        # Preservar rol admin existente o actualizar si fue promovido a docente
        existing_role = row.get("rol", "estudiante")
        final_role = "admin" if (existing_role == "admin" or is_docente) else "estudiante"
        if final_role != existing_role:
            await db.execute("UPDATE usuarios SET rol = $1 WHERE id = $2", final_role, user_id)
        logger.info("Usuario UPEC inició sesión vía Microsoft: %s (rol=%s)", email, final_role)

    # 7. Generar Token JWT de AMY
    jwt_token = create_access_token({"sub": user_id, "rol": final_role})

    return AuthResponse(
        token=jwt_token,
        user=UserOut(id=user_id, email=email, nombre=nombre, rol=final_role)
    )


