"""Persist and retrieve conversation history from PostgreSQL."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.conversation import Conversation, Message


class HistoryManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_recent_conversations(
        self,
        tenant_id: str,
        phone: str,
        limit: int = 5,
    ) -> list[dict]:
        """Retrieve summaries of past conversations for context injection."""
        result = await self.db.execute(
            select(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.phone == phone,
            )
            .order_by(Conversation.started_at.desc())
            .limit(limit)
        )
        conversations = result.scalars().all()
        return [
            {
                "date": str(c.started_at.date()),
                "summary": c.summary,
                "intent": c.primary_intent,
            }
            for c in conversations
            if c.summary
        ]

    async def save_message(
        self,
        tenant_id: str,
        conversation_id: str,
        role: str,
        content: str,
        message_type: str = "text",
    ) -> Message:
        msg = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            role=role,
            content=content,
            message_type=message_type,
        )
        self.db.add(msg)
        await self.db.flush()
        return msg

    async def get_or_create_conversation(
        self,
        tenant_id: str,
        phone: str,
        lead_id: str | None = None,
    ) -> "Conversation":
        result = await self.db.execute(
            select(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.phone == phone,
                Conversation.status == "active",
            )
            .order_by(Conversation.started_at.desc())
            .limit(1)
        )
        conv = result.scalar_one_or_none()
        if conv:
            return conv

        conv = Conversation(
            tenant_id=tenant_id,
            phone=phone,
            lead_id=lead_id,
            status="active",
        )
        self.db.add(conv)
        await self.db.flush()
        return conv
