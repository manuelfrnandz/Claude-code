import hashlib
import hmac
from typing import Any

import httpx
import structlog

from apps.api.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

GRAPH_BASE = f"{settings.meta_graph_url}/{settings.meta_api_version}"


def verify_webhook_signature(payload: bytes, signature_header: str) -> bool:
    """Validate X-Hub-Signature-256 from Meta."""
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.meta_app_secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    received = signature_header[len("sha256="):]
    return hmac.compare_digest(expected, received)


async def get_media_url(media_id: str, access_token: str) -> str:
    """Resolve a media_id to a downloadable URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_BASE}/{media_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["url"]


async def download_media(url: str, access_token: str) -> bytes:
    """Download media bytes from a Meta CDN URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.content


async def send_message(phone_number_id: str, access_token: str, payload: dict[str, Any]) -> dict:
    """POST to /messages endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GRAPH_BASE}/{phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
