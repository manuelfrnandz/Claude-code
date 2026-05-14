from __future__ import annotations

import uuid

from fastapi import APIRouter, Query
from sqlalchemy import select

from apps.api.dependencies import DBSession, TenantID
from apps.api.models.conversation import Conversation, Message

router = APIRouter()


@router.get("")
async def list_conversations(
    tenant_id: TenantID,
    db: DBSession,
    conv_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(Conversation).where(Conversation.tenant_id == uuid.UUID(tenant_id))
    if conv_status:
        q = q.where(Conversation.status == conv_status)
    q = q.order_by(Conversation.started_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: uuid.UUID,
    tenant_id: TenantID,
    db: DBSession,
):
    result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.tenant_id == uuid.UUID(tenant_id),
        )
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()
