"""Multi-step appointment booking flow."""
from __future__ import annotations

from apps.api.services.ai.claude_client import chat_structured
from apps.api.services.ai.prompt_builder import build_system_prompt
from apps.api.services.flows.base_flow import BaseFlow, FlowResult
from apps.api.services.memory.session_manager import SessionData

APPOINTMENT_TOOL = {
    "name": "save_appointment",
    "description": "Save a confirmed appointment booking.",
    "input_schema": {
        "type": "object",
        "properties": {
            "service": {"type": "string", "description": "Service or reason for appointment"},
            "requested_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
            "requested_time": {"type": "string", "description": "HH:MM 24h format"},
            "customer_name": {"type": "string"},
            "notes": {"type": "string"},
            "confirmed": {"type": "boolean"},
        },
        "required": ["service", "requested_date", "requested_time", "confirmed"],
    },
}

APPOINTMENT_SYSTEM_SUFFIX = """
[FLUJO DE CITAS ACTIVO]
Estás en modo de agendamiento de citas. Sigue estos pasos:
1. Pregunta qué servicio necesita.
2. Consulta preferencia de fecha y hora.
3. Verifica disponibilidad según el horario del negocio.
4. Solicita nombre del cliente si no lo sabes.
5. Confirma los detalles de la cita.
6. SOLO cuando el cliente confirme, usa la herramienta `save_appointment` con confirmed=true.
7. Envía un resumen de confirmación con la información de la cita.
"""


class AppointmentFlow(BaseFlow):
    flow_name = "appointment"

    async def start(self, message: str, session: SessionData) -> FlowResult:
        system = build_system_prompt(self.config) + APPOINTMENT_SYSTEM_SUFFIX
        messages = [*self._session_messages(session), {"role": "user", "content": message}]
        return await self._process(system, messages, session)

    async def continue_flow(self, message: str, session: SessionData) -> FlowResult:
        system = build_system_prompt(self.config) + APPOINTMENT_SYSTEM_SUFFIX
        messages = [*self._session_messages(session), {"role": "user", "content": message}]
        return await self._process(system, messages, session)

    async def _process(self, system: str, messages: list, session: SessionData) -> FlowResult:
        text, tool_calls = await chat_structured(
            system_prompt=system,
            messages=messages,
            tools=[APPOINTMENT_TOOL],
        )

        appointment_data = None
        clear_flow = False

        for call in tool_calls:
            if call["name"] == "save_appointment" and call["input"].get("confirmed"):
                appointment_data = call["input"]
                appointment_data["tenant_id"] = self.config.tenant_id
                appointment_data["lead_phone"] = session.phone
                clear_flow = True
                text = text or "¡Cita agendada! Te esperamos. 📅"

        return FlowResult(
            response=text or "¿Para cuándo te gustaría agendar?",
            set_flow=None if clear_flow else self.flow_name,
            clear_flow=clear_flow,
            save_appointment=appointment_data,
        )

    def _session_messages(self, session: SessionData) -> list[dict]:
        return session.messages[-10:] if session.messages else []
