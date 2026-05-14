"""Transcribe audio using OpenAI Whisper API."""
from __future__ import annotations

import structlog
from openai import AsyncOpenAI

from apps.api.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/ogg") -> str:
    """Transcribe audio bytes to text via Whisper. Returns empty string on failure."""
    client = get_openai_client()

    # Determine file extension from mime type
    ext_map = {
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/webm": "webm",
    }
    ext = ext_map.get(mime_type, "ogg")

    try:
        import io
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = f"audio.{ext}"

        transcript = await client.audio.transcriptions.create(
            model=settings.whisper_model,
            file=audio_file,
            language="es",
            response_format="text",
        )
        logger.info("audio_transcribed", chars=len(transcript))
        return transcript.strip()
    except Exception as e:
        logger.error("transcription_failed", error=str(e))
        return ""
