# Deploy en Railway

## Variables de entorno requeridas

### Core
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del servidor | `3001` (Railway lo sobreescribe automáticamente) |
| `APP_SECRET_KEY` | Llave secreta de la app (min 32 chars) | `openssl rand -base64 32` |

### Supabase
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | Dashboard de Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave service_role (bypasa RLS) | Dashboard de Supabase → Project Settings → API → service_role |

### Redis
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `REDIS_URL` | URL de Redis para sesiones | Railway: agregar servicio Redis → copiar URL |
| `BULL_REDIS_URL` | URL de Redis para BullMQ (puede ser la misma) | Igual que `REDIS_URL` pero con `/1` al final |
| `SESSION_TTL_SECONDS` | TTL de sesiones en Redis | `86400` (24 horas) |

### OpenAI
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `OPENAI_API_KEY` | API key de OpenAI | platform.openai.com → API Keys |
| `OPENAI_CHAT_MODEL` | Modelo para respuestas de chat | `gpt-4o` |
| `OPENAI_INTENT_MODEL` | Modelo para clasificación de intent | `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` | Tokens máximos por respuesta | `1024` |
| `OPENAI_TIMEOUT_MS` | Timeout para requests a OpenAI | `30000` |

### Meta / WhatsApp
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `META_APP_SECRET` | App Secret de la Meta App | Meta for Developers → App → Settings → Basic |
| `META_VERIFY_TOKEN` | Token de verificación del webhook | Inventarlo tú (string arbitrario) → usarlo también en Meta Dashboard |
| `META_API_VERSION` | Versión de la Graph API | `v19.0` |
| `META_GRAPH_URL` | URL base de la Graph API | `https://graph.facebook.com` |

### Rate limiting
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limit global (ms) | `60000` (1 minuto) |
| `RATE_LIMIT_MAX` | Requests máximos por ventana | `60` |

### Admin / Seguridad
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `ADMIN_SECRET` | Token de autenticación para POST /api/v1/setup | `openssl rand -base64 32` |
| `ALLOWED_SETUP_IPS` | IPs permitidas para /setup en producción | Lista separada por comas, ej: `1.2.3.4,5.6.7.8`. Vacío = cualquier IP |

### Worker
| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `DISABLE_WORKER` | Deshabilitar el worker BullMQ en este proceso | `false` (dejar vacío para habilitar) |
| `WORKER_CONCURRENCY` | Jobs concurrentes del worker | `5` |

---

## Pasos para deploy en Railway

### 1. Conectar repositorio a Railway

1. Ir a [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Seleccionar `manuelfrnandz/claude-code`
3. Railway detecta `apps/api/railway.toml` automáticamente

### 2. Agregar servicio Redis

1. En el proyecto de Railway → New → Database → Add Redis
2. Copiar la `REDIS_URL` generada
3. Agregarla como variable de entorno en el servicio API
4. Para `BULL_REDIS_URL` usar la misma URL pero cambiar el número de DB al final: `.../1`

### 3. Configurar variables de entorno

En Railway → servicio API → Variables → agregar todas las variables de la tabla anterior.

Mínimo indispensable para funcionar:
```
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=...
BULL_REDIS_URL=...
OPENAI_API_KEY=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...
ADMIN_SECRET=...
APP_SECRET_KEY=...
```

### 4. Ejecutar migraciones de Supabase

Antes del primer deploy, ejecutar el SQL de migraciones en Supabase:

1. Ir a Supabase Dashboard → SQL Editor
2. Pegar y ejecutar el contenido de `apps/api/supabase/migrations/001_initial.sql`

### 5. Verificar el deploy

Railway detecta `railway.toml` y hace el build con Docker automáticamente.
Esperar que el healthcheck pase:

```bash
curl https://{tu-dominio-railway}/api/v1/health
# → {"status":"ok","timestamp":"..."}
```

---

## Configurar Meta Webhook

Una vez desplegado, registrar la URL del webhook en Meta for Developers:

1. Ir a Meta for Developers → tu App → WhatsApp → Configuration
2. Webhook URL: `https://{tu-dominio-railway}/webhook`
3. Verify Token: el valor de `META_VERIFY_TOKEN`
4. Suscribirse a: `messages`

Railway genera un dominio automáticamente con formato `*.up.railway.app`.

---

## Crear el primer tenant

Después del deploy, crear un tenant con el endpoint de setup:

```bash
curl -X POST https://{tu-dominio-railway}/api/v1/setup \
  -H "Authorization: Bearer {ADMIN_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Mi Negocio",
    "email": "owner@minegocio.com",
    "bot_name": "Asistente",
    "wa_phone_number_id": "{PHONE_NUMBER_ID_DE_META}",
    "wa_access_token": "{ACCESS_TOKEN_DE_META}",
    "personality": "amigable y profesional",
    "language": "español",
    "welcome_message": "¡Hola! ¿En qué te puedo ayudar?"
  }'
# → 201 { "tenant_id": "...", "config_id": "...", "message": "Setup complete" }
```

---

## Dashboard (apps/dashboard)

El dashboard Next.js se despliega como un servicio separado en Railway:

1. New Service → GitHub repo → misma repo
2. Root Directory: `apps/dashboard`
3. Variables de entorno del dashboard:
   ```
   NEXT_PUBLIC_API_URL=https://{tu-dominio-api-railway}
   NEXT_PUBLIC_TENANT_ID={tenant_id del tenant creado}
   NEXTAUTH_SECRET={openssl rand -base64 32}
   NEXTAUTH_URL=https://{tu-dominio-dashboard-railway}
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

---

## Verificación completa

```bash
# 1. Health check
curl https://{dominio-railway}/api/v1/health

# 2. Webhook verification
curl "https://{dominio-railway}/webhook?hub.mode=subscribe&hub.verify_token={META_VERIFY_TOKEN}&hub.challenge=test123"
# → test123

# 3. Setup (crear tenant)
curl -X POST https://{dominio-railway}/api/v1/setup \
  -H "Authorization: Bearer {ADMIN_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"business_name":"Test","email":"test@test.com"}'
# → 201

# 4. Enviar mensaje de WhatsApp al número configurado
#    → respuesta automática del bot
#    → registro en Supabase tablas messages y leads
```
