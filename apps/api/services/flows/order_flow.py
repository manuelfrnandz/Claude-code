"""Multi-step order taking flow."""
from __future__ import annotations

from apps.api.services.ai.claude_client import chat_structured
from apps.api.services.ai.prompt_builder import build_system_prompt
from apps.api.services.flows.base_flow import BaseFlow, FlowResult
from apps.api.services.memory.session_manager import SessionData

# Claude tool definition for structured order extraction
ORDER_TOOL = {
    "name": "save_order",
    "description": "Save a confirmed customer order with all items and delivery details.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "quantity": {"type": "integer"},
                        "unit_price": {"type": "number"},
                        "notes": {"type": "string"},
                    },
                    "required": ["name", "quantity"],
                },
            },
            "delivery_type": {"type": "string", "enum": ["pickup", "delivery"]},
            "delivery_address": {"type": "string"},
            "payment_method": {"type": "string"},
            "special_instructions": {"type": "string"},
            "confirmed": {"type": "boolean"},
        },
        "required": ["items", "confirmed"],
    },
}

ORDER_SYSTEM_SUFFIX = """
[FLUJO DE ORDEN ACTIVO]
Estás en modo de toma de pedidos. Sigue estos pasos en orden:
1. Confirma qué desea pedir el cliente (usa el catálogo disponible).
2. Pregunta si es para entrega a domicilio o recoger en tienda.
3. Si es domicilio, solicita la dirección.
4. Pregunta método de pago si aplica.
5. Lee el resumen del pedido al cliente y pide confirmación.
6. SOLO cuando el cliente confirme, usa la herramienta `save_order` con confirmed=true.
7. Da el número de pedido al cliente.

Si el cliente quiere cancelar, di que está bien y ofrece ayuda adicional.
"""


class OrderFlow(BaseFlow):
    flow_name = "order"

    async def start(self, message: str, session: SessionData) -> FlowResult:
        system = build_system_prompt(self.config) + ORDER_SYSTEM_SUFFIX
        messages = [
            *self._session_messages(session),
            {"role": "user", "content": message},
        ]
        return await self._process(system, messages, session)

    async def continue_flow(self, message: str, session: SessionData) -> FlowResult:
        system = build_system_prompt(self.config) + ORDER_SYSTEM_SUFFIX
        messages = [
            *self._session_messages(session),
            {"role": "user", "content": message},
        ]
        return await self._process(system, messages, session)

    async def _process(self, system: str, messages: list, session: SessionData) -> FlowResult:
        text, tool_calls = await chat_structured(
            system_prompt=system,
            messages=messages,
            tools=[ORDER_TOOL],
        )

        order_data = None
        clear_flow = False

        for call in tool_calls:
            if call["name"] == "save_order" and call["input"].get("confirmed"):
                order_data = call["input"]
                order_data["tenant_id"] = self.config.tenant_id
                order_data["lead_phone"] = session.phone
                clear_flow = True
                text = text or "¡Pedido recibido! Te avisaremos cuando esté listo. 🎉"

        return FlowResult(
            response=text or "¿Qué deseas pedir?",
            set_flow=None if clear_flow else self.flow_name,
            clear_flow=clear_flow,
            save_order=order_data,
        )

    def _session_messages(self, session: SessionData) -> list[dict]:
        return session.messages[-10:] if session.messages else []
