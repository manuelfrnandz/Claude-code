import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from apps.api.config import get_settings
from apps.api.db.database import init_db
from apps.api.routers import webhook, tenants, leads, orders, conversations

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", env=settings.app_env)
    await init_db()
    yield
    logger.info("shutdown")


app = FastAPI(
    title="WhatsApp AI Agent",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"] if not settings.is_production else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.is_production:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

app.include_router(webhook.router, prefix="/webhook", tags=["webhook"])
app.include_router(tenants.router, prefix="/api/v1/tenants", tags=["tenants"])
app.include_router(leads.router, prefix="/api/v1/leads", tags=["leads"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(conversations.router, prefix="/api/v1/conversations", tags=["conversations"])


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
