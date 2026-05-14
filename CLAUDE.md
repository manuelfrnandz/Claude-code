# WhatsApp AI Agent — Project Context for Claude Code

## What this project is

Multi-tenant SaaS that deploys AI-powered WhatsApp bots for businesses.
Each business (tenant) gets its own bot personality, catalog, and conversation flows.

## Stack

- **Backend**: Python 3.11, FastAPI (async), SQLAlchemy 2 (async), Alembic
- **AI**: Anthropic Claude API (`claude-sonnet-4-6` default), OpenAI Whisper (STT)
- **DB**: PostgreSQL (Supabase in production), Redis (sessions/cache)
- **WhatsApp**: Meta Cloud API (NOT Twilio)
- **Dashboard**: Next.js 15, TypeScript, Tailwind CSS, TanStack Query
- **Deploy**: Railway/Render (MVP) → AWS ECS

## Project layout

```
apps/api/        — FastAPI backend
  config.py      — All settings via pydantic-settings (reads .env)
  main.py        — App factory, router includes
  models/        — SQLAlchemy ORM models (one file per entity)
  routers/       — FastAPI route handlers (thin, delegate to services)
  services/      — Business logic
    whatsapp/    — Meta API client, message parser, sender
    ai/          — Claude client, prompt builder, intent classifier, engine
    flows/       — Conversation flow state machines (order, appointment, etc.)
    memory/      — Redis session + PostgreSQL history
    audio/       — Download from Meta + Whisper transcription
    handoff/     — Human escalation detection + notification
  tasks/         — Async background tasks (process_message.py is the core)
  db/            — SQLAlchemy engine, Base, Alembic setup
  utils/         — Logging, order numbers, validators

apps/dashboard/  — Next.js dashboard
  app/           — App Router pages
  components/    — UI components (shadcn-style)
  lib/api.ts     — Axios client + typed API helpers
```

## Key design decisions

1. **Multi-tenancy**: All DB tables have `tenant_id`. Resolved from `wa_phone_number_id`
   on incoming webhooks. Redis keys are prefixed `{tenant_id}:{phone}:session`.

2. **Message flow**: Webhook → FastAPI background task → `process_message.py` →
   SessionManager (Redis) → AIEngine → FlowEngine → send reply.

3. **Flows**: Structured conversation flows (order, appointment) use Claude tool use
   to extract structured data. FAQs and general chat use plain `chat()`.

4. **Prompt building**: `services/ai/prompt_builder.py` generates system prompts
   dynamically from `TenantConfig` DB record. Never hardcode business data.

5. **Audio**: WhatsApp sends `.ogg` audio. We download via Meta API, store in S3/R2,
   transcribe via Whisper, then treat as text. Audio deleted after 24h.

## Development setup

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, META_*, DATABASE_URL, REDIS_URL

# Start dependencies
docker compose -f infrastructure/docker/docker-compose.yml up postgres redis -d

# Install Python deps
pip install -e ".[dev]"

# Run migrations
alembic upgrade head

# Start API
uvicorn apps.api.main:app --reload --port 8000

# Start dashboard
cd apps/dashboard && npm install && npm run dev
```

## Running tests

```bash
pytest tests/ -v
```

## Adding a new flow

1. Create `apps/api/services/flows/my_flow.py` extending `BaseFlow`
2. Implement `start()` and `continue_flow()` methods
3. Register in `AIEngine._get_flow()` in `services/ai/engine.py`
4. Add flow name to `PLANS` enablement check if needed

## Adding a new tenant (via API)

```bash
PUT /api/v1/tenants/{tenant_id}/config
X-Tenant-ID: {tenant_id}
{
  "business_name": "Mi Restaurante",
  "bot_name": "Robi",
  "wa_phone_number_id": "1234567890",
  "orders_enabled": true,
  "catalog_data": [...]
}
```

## Environment variables reference

See `.env.example` for all variables with explanations.
Critical ones: `ANTHROPIC_API_KEY`, `META_VERIFY_TOKEN`, `META_APP_SECRET`,
`DATABASE_URL`, `REDIS_URL`, `APP_SECRET_KEY`.
