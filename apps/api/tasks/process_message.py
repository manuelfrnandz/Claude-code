"""
Core async task: receives a parsed WhatsApp message, runs the AI engine,
persists results, and sends the reply back to the user.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import get_settings
from apps.api.db.database import AsyncSessionLocal
from apps.api.models.appointment import Appointment
from apps.api.models.lead import Lead
from apps.api.models.order import Order
from apps.api.services.ai.engine import AIEngine
from apps.api.services.audio.downloader import download_and_store
from apps.api.services.audio.transcriber import transcribe_audio
from apps.api.services.handoff.notifier import notify_handoff
from apps.api.services.memory.history_manager import HistoryManager
from apps.api.services.memory.session_manager import SessionManager
from apps.api.services.whatsapp.message_parser import MessageType, ParsedMessage
from apps.api.services.whatsapp.sender import send_text
from apps.api.utils.order_number import generate_order_number

logger = structlog.get_logger()
settings = get_settings()


async def process_incoming_message(tenant_id: str, parsed_message: ParsedMessage) -> None:
    log = logger.bind(tenant=tenant_id, phone=parsed_message.from_phone)

    async with AsyncSessionLocal() as db:
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        try:
            await _process(tenant_id, parsed_message, db, redis, log)
        finally:
            await redis.aclose()


async def _process(
    tenant_id: str,
    msg: ParsedMessage,
    db: AsyncSession,
    redis: aioredis.Redis,
    log,
) -> None:
    from sqlalchemy import select
    from apps.api.models.tenant import TenantConfig

    # Load tenant config
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.wa_phone_number_id == tenant_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        log.error("tenant_config_not_found")
        return

    session_mgr = SessionManager(redis)
    history_mgr = HistoryManager(db)
    session = await session_mgr.get_or_create(str(config.tenant_id), msg.from_phone)

    # Skip if human handoff is active
    if session.handoff_active:
        log.info("handoff_active_skipping_bot")
        return

    # Resolve text content (transcribe audio if needed)
    text = msg.text or ""
    if msg.type == MessageType.audio and msg.media_id:
        audio_bytes, _ = await download_and_store(
            msg.media_id, config.wa_access_token or "", str(config.tenant_id), msg.media_mime_type or "audio/ogg"
        )
        text = await transcribe_audio(audio_bytes, msg.media_mime_type or "audio/ogg")
        if not text:
            await send_text(
                tenant_id, config.wa_access_token or "", msg.from_phone,
                "Disculpa, no pude entender el audio. ¿Puedes escribir tu mensaje?"
            )
            return

    if not text.strip():
        return

    # Persist or get lead
    lead = await _get_or_create_lead(db, str(config.tenant_id), msg.from_phone)

    # Get DB history for context
    db_history = await history_mgr.get_recent_conversations(str(config.tenant_id), msg.from_phone)

    # Get or create conversation
    conv = await history_mgr.get_or_create_conversation(
        str(config.tenant_id), msg.from_phone, str(lead.id)
    )

    # Save user message to DB
    await history_mgr.save_message(str(config.tenant_id), str(conv.id), "user", text)

    # Add to session
    session.add_message("user", text)

    # Run AI engine
    engine = AIEngine(config)
    result_flow = await engine.process(text, session, db_history)

    # Handle side effects
    if result_flow.trigger_handoff:
        session.handoff_active = True
        await notify_handoff(
            tenant_id=str(config.tenant_id),
            phone=msg.from_phone,
            customer_name=session.customer_name,
            conversation_summary=_build_summary(session.messages),
            notification_email=config.notification_email,
            notification_phone=config.phone_human,
        )

    if result_flow.save_order:
        await _persist_order(db, result_flow.save_order, str(lead.id), str(conv.id))

    if result_flow.save_appointment:
        await _persist_appointment(db, result_flow.save_appointment, str(lead.id), str(conv.id))

    if result_flow.save_lead:
        for k, v in result_flow.save_lead.items():
            if hasattr(lead, k) and v:
                setattr(lead, k, v)

    # Update session flow state
    if result_flow.set_flow:
        session.active_flow = result_flow.set_flow
    if result_flow.clear_flow:
        session.active_flow = None
    if result_flow.update_session:
        for k, v in result_flow.update_session.items():
            if hasattr(session, k):
                setattr(session, k, v)

    # Add bot response to session & DB
    session.add_message("assistant", result_flow.response)
    await history_mgr.save_message(str(config.tenant_id), str(conv.id), "assistant", result_flow.response)

    # Persist session
    await session_mgr.save(session)

    # Send reply
    await send_text(tenant_id, config.wa_access_token or "", msg.from_phone, result_flow.response)
    log.info("response_sent", chars=len(result_flow.response))


async def _get_or_create_lead(db: AsyncSession, tenant_id: str, phone: str) -> Lead:
    from sqlalchemy import select
    result = await db.execute(
        select(Lead).where(Lead.tenant_id == uuid.UUID(tenant_id), Lead.phone_number == phone)
    )
    lead = result.scalar_one_or_none()
    if lead:
        lead.last_contact_at = datetime.now(timezone.utc)
        return lead

    lead = Lead(tenant_id=uuid.UUID(tenant_id), phone_number=phone)
    db.add(lead)
    await db.flush()
    return lead


async def _persist_order(db: AsyncSession, order_data: dict, lead_id: str, conv_id: str) -> Order:
    items = order_data.get("items", [])
    total = sum(
        item.get("unit_price", 0) * item.get("quantity", 1) for item in items
    )
    order = Order(
        tenant_id=uuid.UUID(order_data["tenant_id"]),
        lead_id=uuid.UUID(lead_id),
        conversation_id=uuid.UUID(conv_id),
        order_number=generate_order_number(),
        items=items,
        total=total,
        subtotal=total,
        delivery_type=order_data.get("delivery_type", "pickup"),
        payment_method=order_data.get("payment_method"),
        notes=order_data.get("special_instructions"),
    )
    db.add(order)
    await db.flush()
    return order


async def _persist_appointment(
    db: AsyncSession, appt_data: dict, lead_id: str, conv_id: str
) -> Appointment:
    appt = Appointment(
        tenant_id=uuid.UUID(appt_data["tenant_id"]),
        lead_id=uuid.UUID(lead_id),
        conversation_id=uuid.UUID(conv_id),
        service=appt_data.get("service", ""),
        customer_name=appt_data.get("customer_name"),
        customer_phone=appt_data.get("lead_phone", ""),
        requested_date=appt_data.get("requested_date", ""),
        requested_time=appt_data.get("requested_time", ""),
        notes=appt_data.get("notes"),
    )
    db.add(appt)
    await db.flush()
    return appt


def _build_summary(messages: list[dict]) -> str:
    lines = [f"{m['role'].upper()}: {m['content']}" for m in messages[-6:]]
    return "\n".join(lines)
