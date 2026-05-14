#!/usr/bin/env python3
"""Register or update the WhatsApp webhook URL with Meta Graph API."""
import os
import sys

import httpx


def setup_webhook(phone_number_id: str, webhook_url: str, verify_token: str) -> None:
    access_token = os.environ["META_ACCESS_TOKEN"]
    api_version = os.environ.get("META_API_VERSION", "v19.0")

    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/subscribed_apps"

    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "callback_url": webhook_url,
            "verify_token": verify_token,
            "subscribed_fields": ["messages"],
        },
    )

    if resp.status_code == 200:
        print(f"Webhook registered successfully: {webhook_url}")
    else:
        print(f"Error: {resp.status_code} — {resp.text}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python setup_webhook.py <phone_number_id> <webhook_url> <verify_token>")
        sys.exit(1)

    setup_webhook(sys.argv[1], sys.argv[2], sys.argv[3])
