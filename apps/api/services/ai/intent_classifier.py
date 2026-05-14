"""Lightweight intent classification to route messages to the correct flow."""
from enum import Enum

from apps.api.services.ai.claude_client import chat

INTENT_SYSTEM = """\
You are an intent classifier for a WhatsApp business bot.
Classify the user message into ONE of these intents:
- order: user wants to buy, order, or purchase something
- appointment: user wants to schedule, book, or cancel an appointment
- faq: user has a question about the business (hours, location, prices, policies)
- lead: user is asking for information without clear purchase intent (first contact)
- handoff: user explicitly wants a human agent
- status: user asking about an existing order or appointment status
- complaint: user is expressing dissatisfaction or filing a complaint
- other: anything else

Respond with ONLY the intent name, nothing else.
"""


class Intent(str, Enum):
    order = "order"
    appointment = "appointment"
    faq = "faq"
    lead = "lead"
    handoff = "handoff"
    status = "status"
    complaint = "complaint"
    other = "other"


HANDOFF_KEYWORDS = [
    "quiero hablar con alguien", "hablar con humano", "agente humano",
    "persona real", "soporte humano", "necesito ayuda de verdad",
    "hablar con una persona", "comunicarme con alguien",
]

COMPLAINT_KEYWORDS = [
    "reclamación", "reclamar", "queja", "mal servicio", "insatisfecho",
    "problema con mi pedido", "no llegó", "llegó mal", "reembolso", "devolución",
]


def _check_keywords(text: str, keywords: list[str]) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in keywords)


async def classify_intent(message_text: str, enabled_flows: list[str]) -> Intent:
    """Classify user intent. Fast-path keyword matching, then LLM fallback."""
    if _check_keywords(message_text, HANDOFF_KEYWORDS):
        return Intent.handoff
    if _check_keywords(message_text, COMPLAINT_KEYWORDS):
        return Intent.complaint

    result = await chat(
        system_prompt=INTENT_SYSTEM,
        messages=[{"role": "user", "content": message_text}],
        max_tokens=10,
        temperature=0.0,
    )

    intent_str = result.strip().lower()
    try:
        intent = Intent(intent_str)
    except ValueError:
        intent = Intent.other

    # Downgrade to faq/lead if the flow isn't enabled for this tenant
    if intent == Intent.order and "orders" not in enabled_flows:
        intent = Intent.faq
    if intent == Intent.appointment and "appointments" not in enabled_flows:
        intent = Intent.faq

    return intent
