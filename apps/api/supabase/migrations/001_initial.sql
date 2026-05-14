-- WhatsApp AI Agent — initial schema
-- Phase 1: tenants, tenant_configs, conversations, messages, leads

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'starter',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tenant Configs ───────────────────────────────────────────────────────────
CREATE TABLE tenant_configs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  -- WhatsApp credentials
  wa_phone_number_id   TEXT,
  wa_access_token      TEXT,
  -- Bot identity
  bot_name             TEXT NOT NULL DEFAULT 'Asistente',
  business_name        TEXT NOT NULL DEFAULT '',
  business_description TEXT,
  personality          TEXT NOT NULL DEFAULT 'amigable',
  language             TEXT NOT NULL DEFAULT 'español',
  -- Prompt override: if set, used verbatim as system prompt
  system_prompt        TEXT,
  -- Business data (stored as JSONB arrays)
  catalog_data         JSONB,
  faq_data             JSONB,
  schedule             JSONB,
  -- Contact info
  location             TEXT,
  phone_human          TEXT,
  notification_email   TEXT,
  website              TEXT,
  -- Conversation settings
  welcome_message      TEXT,
  escalation_triggers  TEXT[],
  -- conversation_mode controls bot behavior:
  --   ai     → bot responds only
  --   human  → bot silent, human agent attends
  --   hybrid → bot responds + logs for human supervisor
  conversation_mode    TEXT NOT NULL DEFAULT 'ai',
  enabled_intents      TEXT[] NOT NULL DEFAULT ARRAY['ventas','soporte','citas'],
  orders_enabled       BOOLEAN NOT NULL DEFAULT false,
  appointments_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast tenant resolution from incoming webhook
CREATE INDEX idx_tenant_configs_phone ON tenant_configs(wa_phone_number_id);

-- ─── Conversations ────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone          TEXT NOT NULL,
  -- status: active | closed | handoff
  status         TEXT NOT NULL DEFAULT 'active',
  -- mode overrides tenant_configs.conversation_mode for this conversation
  mode           TEXT NOT NULL DEFAULT 'ai',
  primary_intent TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ
);

CREATE INDEX idx_conversations_tenant_phone ON conversations(tenant_id, phone);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  phone           TEXT NOT NULL,
  role            TEXT NOT NULL,              -- user | assistant
  content         TEXT NOT NULL,
  message_type    TEXT NOT NULL DEFAULT 'text', -- text | audio
  wa_message_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
-- Prevents processing the same WhatsApp message twice
CREATE UNIQUE INDEX idx_messages_wa_message_id ON messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- ─── Leads ────────────────────────────────────────────────────────────────────
CREATE TABLE leads (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number     TEXT NOT NULL,
  name             TEXT,
  email            TEXT,
  -- stage: nuevo | calificado | convertido | perdido
  stage            TEXT NOT NULL DEFAULT 'nuevo',
  intent_detected  TEXT,
  first_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contact_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe upsert on (tenant_id, phone_number)
CREATE UNIQUE INDEX idx_leads_tenant_phone ON leads(tenant_id, phone_number);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- No permissive policies — only service_role key bypasses RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_configs_updated_at
  BEFORE UPDATE ON tenant_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
