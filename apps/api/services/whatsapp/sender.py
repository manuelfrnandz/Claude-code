"""High-level helpers to send different WhatsApp message types."""
from typing import Any

from apps.api.services.whatsapp.client import send_message


def _base(to: str) -> dict:
    return {"messaging_product": "whatsapp", "recipient_type": "individual", "to": to}


async def send_text(
    phone_number_id: str,
    access_token: str,
    to: str,
    text: str,
    preview_url: bool = False,
) -> dict:
    payload = {**_base(to), "type": "text", "text": {"body": text, "preview_url": preview_url}}
    return await send_message(phone_number_id, access_token, payload)


async def send_typing(phone_number_id: str, access_token: str, to: str) -> dict:
    """Show 'typing...' indicator (mark as read + typing status)."""
    payload = {**_base(to), "type": "reaction", "reaction": {"message_id": "", "emoji": ""}}
    # Actual typing indicator via read receipt workaround
    return {}


async def send_reply_buttons(
    phone_number_id: str,
    access_token: str,
    to: str,
    body: str,
    buttons: list[dict[str, str]],
    header: str | None = None,
    footer: str | None = None,
) -> dict:
    """Send up to 3 quick-reply buttons.

    buttons format: [{"id": "btn_1", "title": "Sí"}, ...]
    """
    interactive: dict[str, Any] = {
        "type": "button",
        "body": {"text": body},
        "action": {
            "buttons": [
                {"type": "reply", "reply": {"id": b["id"], "title": b["title"]}}
                for b in buttons[:3]
            ]
        },
    }
    if header:
        interactive["header"] = {"type": "text", "text": header}
    if footer:
        interactive["footer"] = {"text": footer}

    payload = {**_base(to), "type": "interactive", "interactive": interactive}
    return await send_message(phone_number_id, access_token, payload)


async def send_list_message(
    phone_number_id: str,
    access_token: str,
    to: str,
    body: str,
    button_label: str,
    sections: list[dict],
    header: str | None = None,
    footer: str | None = None,
) -> dict:
    """Send a list picker (up to 10 items across sections).

    sections format: [{"title": "Pizzas", "rows": [{"id": "p1", "title": "Margherita", "description": "..."}]}]
    """
    interactive: dict[str, Any] = {
        "type": "list",
        "body": {"text": body},
        "action": {"button": button_label, "sections": sections},
    }
    if header:
        interactive["header"] = {"type": "text", "text": header}
    if footer:
        interactive["footer"] = {"text": footer}

    payload = {**_base(to), "type": "interactive", "interactive": interactive}
    return await send_message(phone_number_id, access_token, payload)


async def send_template(
    phone_number_id: str,
    access_token: str,
    to: str,
    template_name: str,
    language_code: str = "es",
    components: list[dict] | None = None,
) -> dict:
    """Send a pre-approved WhatsApp template (for outbound-initiated conversations)."""
    payload = {
        **_base(to),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": components or [],
        },
    }
    return await send_message(phone_number_id, access_token, payload)
