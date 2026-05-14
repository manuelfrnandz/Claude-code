"""Lead capture flow — collects name and intent on first contact."""
from __future__ import annotations

from apps.api.services.ai.claude_client import chat
from apps.api.services.ai.prompt_builder import build_system_prompt
from apps.api.services.flows.base_flow import BaseFlow, FlowResult
from apps.api.services.memory.session_manager import SessionData

LEAD_SUFFIX = """
[CAPTURA DE LEAD]
Es el primer contacto de este cliente. Objetivos:
1. Dar una bienvenida cálida con el nombre del negocio.
2. Presentarte brevemente.
3. Preguntar en qué puedes ayudarle.
4. Si el cliente da su nombre, úsalo de ahí en adelante.
5. Identificar su intención principal (compra, información, cita, soporte).

No hagas múltiples preguntas a la vez. Una sola pregunta por mensaje.
"""


class LeadCaptureFlow(BaseFlow):
    flow_name = "lead_capture"

    async def start(self, message: str, session: SessionData) -> FlowResult:
        system = build_system_prompt(self.config) + LEAD_SUFFIX
        messages = [{"role": "user", "content": message}]
        text = await chat(system_prompt=system, messages=messages)
        return FlowResult(
            response=text,
            update_session={"lead_stage": "new"},
        )

    async def continue_flow(self, message: str, session: SessionData) -> FlowResult:
        system = build_system_prompt(self.config)
        messages = [*session.messages[-6:], {"role": "user", "content": message}]
        text = await chat(system_prompt=system, messages=messages)
        return FlowResult(response=text)
