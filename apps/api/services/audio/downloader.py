"""Download audio from Meta CDN and optionally store in S3/R2."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import boto3
import structlog

from apps.api.config import get_settings
from apps.api.services.whatsapp.client import download_media, get_media_url

logger = structlog.get_logger()
settings = get_settings()


def _get_s3_client():
    kwargs = {
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "region_name": settings.aws_region,
    }
    if settings.storage_provider == "r2":
        kwargs["endpoint_url"] = settings.r2_endpoint_url
    return boto3.client("s3", **kwargs)


async def download_audio(media_id: str, access_token: str) -> bytes:
    """Download audio bytes from Meta CDN."""
    url = await get_media_url(media_id, access_token)
    return await download_media(url, access_token)


async def download_and_store(
    media_id: str,
    access_token: str,
    tenant_id: str,
    mime_type: str = "audio/ogg",
) -> tuple[bytes, str]:
    """Download audio, store in S3/R2, and return (bytes, s3_key)."""
    audio_bytes = await download_audio(media_id, access_token)

    ext_map = {"audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a"}
    ext = ext_map.get(mime_type, "ogg")
    key = f"audio/{tenant_id}/{datetime.utcnow().strftime('%Y/%m/%d')}/{uuid.uuid4()}.{ext}"

    try:
        s3 = _get_s3_client()
        s3.put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=audio_bytes,
            ContentType=mime_type,
            # Auto-delete after retention period
            Expires=datetime.utcnow() + timedelta(hours=settings.audio_retention_hours),
        )
        logger.info("audio_stored", key=key, size=len(audio_bytes))
    except Exception as e:
        logger.warning("audio_store_failed", error=str(e))

    return audio_bytes, key
