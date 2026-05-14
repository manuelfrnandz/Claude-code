from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from apps.api.services.memory.session_manager import SessionData


@dataclass
class FlowResult:
    """What the engine returns after processing one message."""
    response: str
    # If set, this flow becomes the active one in session
    set_flow: str | None = None
    # Clear the active flow (conversation finished)
    clear_flow: bool = False
    # Partial session updates to merge
    update_session: dict[str, Any] = field(default_factory=dict)
    # Side-effect flags
    trigger_handoff: bool = False
    save_lead: dict[str, Any] | None = None
    save_order: dict[str, Any] | None = None
    save_appointment: dict[str, Any] | None = None


class BaseFlow:
    """Abstract base for all conversation flows."""

    flow_name: str = "base"

    def __init__(self, tenant_config):
        self.config = tenant_config

    async def start(self, message: str, session: SessionData) -> FlowResult:
        raise NotImplementedError

    async def continue_flow(self, message: str, session: SessionData) -> FlowResult:
        raise NotImplementedError
