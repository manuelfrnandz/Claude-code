import { z } from 'zod';

const configSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_SECRET_KEY: z.string().min(32, 'APP_SECRET_KEY must be at least 32 characters'),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  BULL_REDIS_URL: z.string().default('redis://localhost:6379/1'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o'),
  OPENAI_INTENT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Meta / WhatsApp
  META_APP_SECRET: z.string().min(1, 'META_APP_SECRET is required'),
  META_VERIFY_TOKEN: z.string().min(1, 'META_VERIFY_TOKEN is required'),
  META_API_VERSION: z.string().default('v19.0'),
  META_GRAPH_URL: z.string().url().default('https://graph.facebook.com'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  // Admin
  ADMIN_SECRET: z.string().min(1, 'ADMIN_SECRET is required'),
  ALLOWED_SETUP_IPS: z.string().default(''),

  // Worker
  DISABLE_WORKER: z.string().default('false'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

function loadConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\n[CONFIG ERROR] Missing or invalid environment variables:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
