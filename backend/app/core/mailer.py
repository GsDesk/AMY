"""
AMY -- Envío de correo por SMTP
Usa smtplib (librería estándar) en un hilo para no bloquear el event loop.

Prueba de configuración desde el contenedor:
    docker compose exec backend python -m app.core.mailer destinatario@correo.com
"""

import asyncio
import logging
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from app.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.smtp_sender)


def _send_sync(msg: EmailMessage) -> None:
    security = settings.SMTP_SECURITY.lower()
    context = ssl.create_default_context()
    timeout = settings.SMTP_TIMEOUT

    if security == "ssl":
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout, context=context)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout)

    with server:
        if security == "starttls":
            server.starttls(context=context)
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Envía un correo. Devuelve False (y lo registra) si SMTP no está configurado o falla."""
    if not is_configured():
        logger.warning("SMTP no configurado: no se envió el correo '%s' a %s", subject, to)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.SMTP_FROM_NAME, settings.smtp_sender))
    msg["To"] = to
    msg["Message-ID"] = make_msgid(domain=settings.smtp_sender.split("@")[-1])
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        await asyncio.to_thread(_send_sync, msg)
    except (smtplib.SMTPException, OSError) as e:
        logger.error("Error enviando correo '%s' a %s: %s", subject, to, e)
        return False

    logger.info("Correo '%s' enviado a %s", subject, to)
    return True


async def send_reset_code(to: str, code: str, minutes: int) -> bool:
    subject = "AMY — Código de recuperación de contraseña"
    text = (
        "Hola,\n\n"
        f"Tu código para restablecer la contraseña de AMY es: {code}\n\n"
        f"Caduca en {minutes} minutos y solo puede usarse una vez.\n"
        "Si no solicitaste este cambio, ignora este correo: tu contraseña sigue igual.\n\n"
        "— AMY, Tutor de Bases de Datos (UPEC)"
    )
    html = f"""\
<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827">Recuperación de contraseña</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Usa este código para restablecer tu contraseña de <strong>AMY</strong>:</p>
      <p style="margin:0 0 20px;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;background:#eef2ff;color:#3730a3;border-radius:8px;padding:16px">{code}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#4b5563">Caduca en {minutes} minutos y solo puede usarse una vez.</p>
      <p style="margin:0;font-size:14px;color:#4b5563">Si no solicitaste este cambio, ignora este correo: tu contraseña sigue igual.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">
      <p style="margin:0;font-size:12px;color:#9ca3af">AMY — Tutor de Bases de Datos · UPEC</p>
    </td></tr>
  </table>
</body>
</html>"""
    return await send_email(to, subject, text, html)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python -m app.core.mailer destinatario@correo.com")
        sys.exit(2)
    logging.basicConfig(level=logging.INFO)
    if not is_configured():
        print("SMTP no configurado: define SMTP_HOST y SMTP_FROM (o SMTP_USER) en .env")
        sys.exit(1)
    ok = asyncio.run(send_email(
        sys.argv[1],
        "AMY — Prueba de SMTP",
        "Si recibes este correo, la configuración SMTP de AMY funciona.",
    ))
    print("Correo enviado" if ok else "Fallo el envío (revisa el log de arriba)")
    sys.exit(0 if ok else 1)
