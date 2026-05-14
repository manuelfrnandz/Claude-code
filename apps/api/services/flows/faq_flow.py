"""FAQ and general Q&A flow — delegates fully to Claude."""
from __future__ import annotations

from apps.api.services.ai.claude_client import chat
from apps.api.services.ai.prompt_builder import build_system_prompt
from apps.api.services.flows.base_flow import BaseFlow, FlowResult
from apps.api.services.memory.session_manager import SessionData


class FAQFlow(BaseFlow):
    flow_name = "faq"

    async def start(self, message: str, session: SessionData) -> FlowResult:
        return await self._respond(message, session)

    async def continue_flow(self, message: str, session: SessionData) -> FlowResult:
        return await self._respond(message, session)

    async def _respond(self, message: str, session: SessionData) -> FlowResult:
        messages = [*session.messages[-8:], {"role": "user", "content": message}]
        text = await chat(
            system_prompt=build_system_prompt(self.config),
            messages=messages,
        )
        return FlowResult(response=text)
