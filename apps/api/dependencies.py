from typing import Annotated, AsyncGenerator

import redis.asyncio as aioredis
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import Settings, get_settings
from apps.api.db.database import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_redis(settings: Annotated[Settings, Depends(get_settings)]) -> aioredis.Redis:
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def get_tenant_id(x_tenant_id: str = Header(...)) -> str:
    """Extract and validate tenant ID from request header."""
    if not x_tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Tenant-ID header required")
    return x_tenant_id


DBSession = Annotated[AsyncSession, Depends(get_db)]
RedisClient = Annotated[aioredis.Redis, Depends(get_redis)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
TenantID = Annotated[str, Depends(get_tenant_id)]
