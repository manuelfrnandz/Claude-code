from enum import Enum
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    development = "development"
    staging = "staging"
    production = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_env: Environment = Environment.development
    app_secret_key: str = Field(min_length=32)
    debug: bool = False

    # Database
    database_url: str
    database_url_sync: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    session_ttl_seconds: int = 86400

    # Claude
    anthropic_api_key: str
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 1024
    claude_timeout_seconds: int = 30

    # OpenAI Whisper
    openai_api_key: str
    whisper_model: str = "whisper-1"

    # Meta WhatsApp
    meta_app_id: str
    meta_app_secret: str
    meta_verify_token: str
    meta_api_version: str = "v19.0"
    meta_graph_url: str = "https://graph.facebook.com"

    # Storage
    storage_provider: str = "r2"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "whatsapp-ai-audio"
    r2_account_id: str = ""
    r2_endpoint_url: str = ""
    audio_retention_hours: int = 24

    # Email
    sendgrid_api_key: str = ""
    from_email: str = "noreply@example.com"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Rate limiting
    rate_limit_per_minute: int = 60
    rate_limit_burst: int = 10

    # Handoff
    handoff_timeout_minutes: int = 30

    @property
    def is_production(self) -> bool:
        return self.app_env == Environment.production


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
