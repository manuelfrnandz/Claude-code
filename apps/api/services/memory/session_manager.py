"""Redis-backed session manager — stores active conversation state."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any

import redis.asyncio as aioredis

from apps.api.config import get_settings

settings = get_settings()

SESSION_KEY = "{tenant_id}:{phone}:session"
MAX_SESSION_MESSAGES = 20


@dataclass
class SessionData:
    tenant_id: str
    phone: str
    messages: list[dict] = field(default_factory=list)
    active_flow: str | None = None
    flow_state: dict[str, Any] = field(default_factory=dict)
    lead_id: str | None = None
    customer_name: str | None = None
    lead_stage: str = "new"
    last_intent: str | None = None
    handoff_active: bool = False
    handoff_agent_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})
        if len(self.messages) > MAX_SESSION_MESSAGES:
            # Keep system summary + last N messages
            self.messages = self.messages[-MAX_SESSION_MESSAGES:]

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str) -> "SessionData":
        return cls(**json.loads(data))


class SessionManager:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis

    def _key(self, tenant_id: str, phone: str) -> str:
        return SESSION_KEY.format(tenant_id=tenant_id, phone=phone)

    async def get_or_create(self, tenant_id: str, phone: str) -> SessionData:
        raw = await self.redis.get(self._key(tenant_id, phone))
        if raw:
            return SessionData.from_json(raw)
        return SessionData(tenant_id=tenant_id, phone=phone)

    async def save(self, session: SessionData) -> None:
        await self.redis.setex(
            self._key(session.tenant_id, session.phone),
            settings.session_ttl_seconds,
            session.to_json(),
        )

    async def delete(self, tenant_id: str, phone: str) -> None:
        await self.redis.delete(self._key(tenant_id, phone))

    async def update(self, session: SessionData, updates: dict[str, Any]) -> None:
        for key, value in updates.items():
            if hasattr(session, key):
                setattr(session, key, value)
            else:
                session.extra[key] = value
        await self.save(session)
