"""Build the messages array to send to Claude, merging session + DB history."""
from __future__ import annotations

from apps.api.services.memory.session_manager import SessionData

MAX_HISTORY_MESSAGES = 12
SUMMARY_TOKEN_THRESHOLD = 8000  # approx chars before we compress


def build_context_messages(
    session: SessionData,
    db_history: list[dict],
    current_message: str,
) -> list[dict]:
    """
    Merge context sources into a single messages list for Claude.

    Priority (newest wins on overlap):
    1. DB history summary (if session is fresh)
    2. Session messages (recent turns)
    3. Current user message
    """
    messages: list[dict] = []

    # If session is brand new but user has history in DB, inject a summary
    if not session.messages and db_history:
        summary = _build_history_summary(db_history)
        if summary:
            messages.append({
                "role": "user",
                "content": f"[Contexto de conversaciones anteriores]\n{summary}",
            })
            messages.append({
                "role": "assistant",
                "content": "Entendido, tengo el contexto de tus visitas anteriores.",
            })

    # Add session messages (the actual recent conversation)
    messages.extend(session.messages[-MAX_HISTORY_MESSAGES:])

    # Add current message
    messages.append({"role": "user", "content": current_message})

    return messages


def _build_history_summary(db_history: list[dict]) -> str | None:
    """Create a short plaintext summary of past interactions."""
    if not db_history:
        return None

    lines = []
    for entry in db_history[-5:]:  # Last 5 past conversations
        date = entry.get("date", "fecha desconocida")
        summary = entry.get("summary", "")
        if summary:
            lines.append(f"- {date}: {summary}")

    return "\n".join(lines) if lines else None
