from dataclasses import dataclass
from enum import Enum
from typing import Any


class MessageType(str, Enum):
    text = "text"
    audio = "audio"
    image = "image"
    document = "document"
    interactive = "interactive"   # button reply / list reply
    unknown = "unknown"


@dataclass
class ParsedMessage:
    wa_message_id: str
    from_phone: str
    timestamp: int
    type: MessageType
    # Text content (original or transcribed from audio)
    text: str | None = None
    # For audio/image/document
    media_id: str | None = None
    media_mime_type: str | None = None
    # For interactive (button/list replies)
    interactive_id: str | None = None
    interactive_title: str | None = None
    # Raw payload for edge cases
    raw: dict | None = None


def parse_incoming_webhook(body: dict[str, Any]) -> list[ParsedMessage]:
    """Extract ParsedMessage objects from a Meta webhook payload."""
    messages: list[ParsedMessage] = []

    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for msg in value.get("messages", []):
                messages.append(_parse_single(msg))

    return messages


def _parse_single(msg: dict) -> ParsedMessage:
    msg_type = msg.get("type", "unknown")
    base = ParsedMessage(
        wa_message_id=msg["id"],
        from_phone=msg["from"],
        timestamp=int(msg.get("timestamp", 0)),
        type=MessageType(msg_type) if msg_type in MessageType._value2member_map_ else MessageType.unknown,
        raw=msg,
    )

    if msg_type == "text":
        base.text = msg.get("text", {}).get("body", "")
    elif msg_type in ("audio", "image", "document"):
        media = msg.get(msg_type, {})
        base.media_id = media.get("id")
        base.media_mime_type = media.get("mime_type")
    elif msg_type == "interactive":
        reply = msg.get("interactive", {})
        reply_type = reply.get("type")
        if reply_type == "button_reply":
            btn = reply.get("button_reply", {})
            base.interactive_id = btn.get("id")
            base.interactive_title = btn.get("title")
            base.text = btn.get("title")
        elif reply_type == "list_reply":
            lst = reply.get("list_reply", {})
            base.interactive_id = lst.get("id")
            base.interactive_title = lst.get("title")
            base.text = lst.get("title")

    return base
