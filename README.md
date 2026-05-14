# WhatsApp AI Agent — SaaS Platform

Plataforma multi-tenant para desplegar agentes de IA en WhatsApp para negocios.

## Capacidades del agente

- Responder preguntas frecuentes automáticamente
- Tomar pedidos y generar órdenes estructuradas
- Agendar citas con confirmación
- Captar y calificar leads
- Derivar a humano cuando se necesita
- Transcribir y responder notas de voz

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 + FastAPI |
| AI | Claude (Anthropic) + Whisper (OpenAI) |
| Base de datos | PostgreSQL + Redis |
| WhatsApp | Meta Cloud API |
| Dashboard | Next.js 15 + Tailwind |

## Inicio rápido

```bash
# 1. Clonar y configurar
cp .env.example .env
# Editar .env con tus keys

# 2. Levantar servicios
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. Migraciones
alembic upgrade head

# 4. API
uvicorn apps.api.main:app --reload

# 5. Dashboard
cd apps/dashboard && npm install && npm run dev
```

## Estructura del proyecto

Ver `CLAUDE.md` para documentación técnica completa.

## Módulos principales

- `apps/api/services/ai/engine.py` — Orquestador principal de IA
- `apps/api/services/ai/prompt_builder.py` — Prompts dinámicos por tenant
- `apps/api/tasks/process_message.py` — Pipeline completo de procesamiento
- `apps/api/services/flows/` — Flujos de conversación (órdenes, citas, FAQ)
- `apps/dashboard/` — Panel de administración para negocios

## Licencia

Propietario — ver LICENSE
