"""WhatsApp webhook — verification + incoming message handler."""
from __future__ import annotations

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status

from apps.api.config import get_settings
from apps.api.services.whatsapp.client import verify_webhook_signature
from apps.api.services.whatsapp.message_parser import MessageType, parse_incoming_webhook
from apps.api.tasks.process_message import process_incoming_message

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter()


@router.get("")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    """Meta webhook verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == settings.meta_verify_token:
        return int(hub_challenge)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid verify token")


@router.post("")
async def receive_message(request: Request, background_tasks: BackgroundTasks):
    """Receive incoming WhatsApp messages and enqueue for async processing."""
    body_bytes = await request.body()

    # Verify Meta signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    if settings.is_production and not verify_webhook_signature(body_bytes, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    body = await request.json()

    # Meta sends a "test" payload on connection — acknowledge silently
    if not body.get("entry"):
        return {"status": "ok"}

    messages = parse_incoming_webhook(body)
    for msg in messages:
        # Resolve tenant from the receiving phone number
        tenant_id = _resolve_tenant(body)
        if not tenant_id:
            logger.warning("tenant_not_found", body=body)
            continue

        # Skip non-actionable message types
        if msg.type not in (MessageType.text, MessageType.audio, MessageType.interactive):
            logger.info("skipping_message_type", type=msg.type)
            continue

        logger.info("message_received", tenant=tenant_id, from_phone=msg.from_phone, type=msg.type)
        background_tasks.add_task(
            process_incoming_message,
            tenant_id=tenant_id,
            parsed_message=msg,
        )

    return {"status": "ok"}


def _resolve_tenant(body: dict) -> str | None:
    """Extract phone_number_id from webhook body to identify the tenant."""
    try:
        return body["entry"][0]["changes"][0]["value"]["metadata"]["phone_number_id"]
    except (KeyError, IndexError):
        return None
