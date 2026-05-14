"""Detect when a conversation should be escalated to a human agent."""
from __future__ import annotations

DEFAULT_TRIGGERS = [
    "quiero hablar con alguien",
    "hablar con humano",
    "agente humano",
    "persona real",
    "soporte humano",
    "necesito ayuda de verdad",
    "hablar con una persona",
    "comunicarme con alguien",
    "quiero un asesor",
    "reclamación",
    "queja formal",
    "reembolso",
    "devolución",
    "no me ayuda",
    "esto no funciona",
]


def should_handoff(message: str, custom_triggers: list[str] | None = None) -> bool:
    """Return True if message contains handoff trigger phrases."""
    triggers = list(DEFAULT_TRIGGERS)
    if custom_triggers:
        triggers.extend(custom_triggers)

    text = message.lower()
    return any(trigger in text for trigger in triggers)


def should_handoff_on_confidence(attempts: int, confidence: float, threshold: float = 0.4) -> bool:
    """Escalate after multiple failed responses."""
    return attempts >= 3 and confidence < threshold
