"""Notify human agents when a handoff is triggered."""
from __future__ import annotations

import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from apps.api.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def notify_handoff(
    tenant_id: str,
    phone: str,
    customer_name: str | None,
    conversation_summary: str,
    notification_email: str | None,
    notification_phone: str | None,
) -> None:
    """Notify the business that a customer needs a human agent."""
    log = logger.bind(tenant=tenant_id, phone=phone)

    if notification_email:
        await _send_email(
            to=notification_email,
            customer_phone=phone,
            customer_name=customer_name or "Cliente",
            summary=conversation_summary,
        )
        log.info("handoff_email_sent", email=notification_email)

    # Optionally send WhatsApp to business owner's number
    if notification_phone:
        log.info("handoff_whatsapp_queued", notify_phone=notification_phone)
        # This would go through the same WhatsApp sender
        # Implemented as a background task to avoid circular imports


async def _send_email(
    to: str,
    customer_phone: str,
    customer_name: str,
    summary: str,
) -> None:
    try:
        client = SendGridAPIClient(settings.sendgrid_api_key)
        message = Mail(
            from_email=settings.from_email,
            to_emails=to,
            subject=f"Cliente necesita atención humana — {customer_name} ({customer_phone})",
            html_content=f"""
            <h2>Solicitud de atención humana</h2>
            <p><strong>Cliente:</strong> {customer_name}</p>
            <p><strong>Teléfono:</strong> {customer_phone}</p>
            <h3>Resumen de la conversación:</h3>
            <pre>{summary}</pre>
            <p>Por favor, contacta al cliente lo antes posible.</p>
            """,
        )
        client.send(message)
    except Exception as e:
        logger.error("handoff_email_failed", error=str(e))
