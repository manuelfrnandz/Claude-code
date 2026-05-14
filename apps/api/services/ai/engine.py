"""Main AI orchestrator: receives a parsed message, returns a response string."""
from __future__ import annotations

import structlog

from apps.api.models.tenant import TenantConfig
from apps.api.services.ai.claude_client import chat
from apps.api.services.ai.intent_classifier import Intent, classify_intent
from apps.api.services.ai.prompt_builder import build_system_prompt
from apps.api.services.flows.base_flow import FlowResult
from apps.api.services.flows.order_flow import OrderFlow
from apps.api.services.flows.appointment_flow import AppointmentFlow
from apps.api.services.flows.faq_flow import FAQFlow
from apps.api.services.flows.lead_capture_flow import LeadCaptureFlow
from apps.api.services.handoff.detector import should_handoff
from apps.api.services.memory.context_builder import build_context_messages
from apps.api.services.memory.session_manager import SessionData

logger = structlog.get_logger()


class AIEngine:
    def __init__(self, tenant_config: TenantConfig):
        self.config = tenant_config
        self.system_prompt = build_system_prompt(tenant_config)

    async def process(
        self,
        user_message: str,
        session: SessionData,
        db_history: list[dict],
    ) -> FlowResult:
        """
        Core processing loop:
        1. Check active flow in session → continue it
        2. Check handoff triggers
        3. Classify intent → route to flow
        4. Call Claude with full context
        5. Return FlowResult with response + side effects
        """
        log = logger.bind(tenant=self.config.tenant_id, phone=session.phone)

        # Continue an active structured flow
        if session.active_flow:
            flow = self._get_flow(session.active_flow)
            if flow:
                log.info("continuing_flow", flow=session.active_flow)
                return await flow.continue_flow(user_message, session)

        # Handoff check (high priority)
        if should_handoff(user_message, self.config.escalation_triggers):
            log.info("handoff_triggered")
            return FlowResult(
                response="Entendido, te voy a conectar con uno de nuestros asesores. Un momento por favor.",
                trigger_handoff=True,
            )

        # Classify intent
        intent = await classify_intent(user_message, self.config.enabled_flows or [])
        log.info("intent_classified", intent=intent)

        # Route to specific flow
        if intent == Intent.order and "orders" in (self.config.enabled_flows or []):
            flow = OrderFlow(self.config)
            return await flow.start(user_message, session)

        if intent == Intent.appointment and "appointments" in (self.config.enabled_flows or []):
            flow = AppointmentFlow(self.config)
            return await flow.start(user_message, session)

        # Default: conversational response with Claude
        messages = build_context_messages(session, db_history, user_message)
        response_text = await chat(
            system_prompt=self.system_prompt,
            messages=messages,
        )

        # Opportunistically capture lead data from the response interaction
        return FlowResult(
            response=response_text,
            update_session={"last_intent": intent.value},
        )

    def _get_flow(self, flow_name: str):
        flows = {
            "order": OrderFlow(self.config),
            "appointment": AppointmentFlow(self.config),
            "faq": FAQFlow(self.config),
            "lead_capture": LeadCaptureFlow(self.config),
        }
        return flows.get(flow_name)
