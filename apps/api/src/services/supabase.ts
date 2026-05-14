import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { TenantConfig, Conversation, StoredMessage, SaveMessageParams } from '../types';

export { type Conversation, type StoredMessage, type SaveMessageParams };

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: {
    transport: ws,
  },
});

// ─── Tenant ───────────────────────────────────────────────────────────────────

export async function getTenantConfigByPhoneNumberId(
  phoneNumberId: string,
): Promise<TenantConfig | null> {
  const { data, error } = await supabase
    .from('tenant_configs')
    .select(
      `id, tenant_id, wa_phone_number_id, wa_access_token,
       bot_name, business_name, business_description, personality, language,
       system_prompt, catalog_data, faq_data, schedule, location,
       phone_human, notification_email, welcome_message, escalation_triggers,
       conversation_mode, enabled_intents, orders_enabled, appointments_enabled`,
    )
    .eq('wa_phone_number_id', phoneNumberId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    waPhoneNumberId: data.wa_phone_number_id as string,
    waAccessToken: data.wa_access_token as string,
    botName: (data.bot_name as string) ?? 'Asistente',
    businessName: (data.business_name as string) ?? '',
    businessDescription: data.business_description as string | null,
    personality: (data.personality as string) ?? 'amigable',
    language: (data.language as string) ?? 'español',
    systemPrompt: data.system_prompt as string | null,
    catalogData: data.catalog_data ?? null,
    faqData: data.faq_data ?? null,
    schedule: data.schedule ?? null,
    location: data.location as string | null,
    phoneHuman: data.phone_human as string | null,
    notificationEmail: data.notification_email as string | null,
    welcomeMessage: data.welcome_message as string | null,
    escalationTriggers: (data.escalation_triggers as string[]) ?? [],
    conversationMode: (data.conversation_mode as TenantConfig['conversationMode']) ?? 'ai',
    enabledIntents: (data.enabled_intents as string[]) ?? ['ventas', 'soporte', 'citas'],
    ordersEnabled: (data.orders_enabled as boolean) ?? false,
    appointmentsEnabled: (data.appointments_enabled as boolean) ?? false,
  };
}

// ─── Conversations ────────────────────────────────────────────────────────────

const CONVERSATION_SELECT = 'id, tenant_id, phone, status, mode, primary_intent, started_at, ended_at';

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row['id'] as string,
    tenantId: row['tenant_id'] as string,
    phone: row['phone'] as string,
    status: row['status'] as Conversation['status'],
    mode: row['mode'] as Conversation['mode'],
    primaryIntent: (row['primary_intent'] as string | null) ?? null,
    startedAt: row['started_at'] as string,
    endedAt: (row['ended_at'] as string | null) ?? null,
  };
}

export async function getOrCreateConversation(
  tenantId: string,
  phone: string,
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return mapConversation(existing as Record<string, unknown>);

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ tenant_id: tenantId, phone })
    .select(CONVERSATION_SELECT)
    .single();

  if (error) throw new Error(`getOrCreateConversation failed: ${error.message}`);
  return mapConversation(created as Record<string, unknown>);
}

export async function updateConversationMode(
  conversationId: string,
  mode: Conversation['mode'],
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ mode, status: mode === 'human' ? 'handoff' : 'active' })
    .eq('id', conversationId);

  if (error) throw new Error(`updateConversationMode failed: ${error.message}`);
}

export async function updateConversationIntent(
  conversationId: string,
  intent: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ primary_intent: intent })
    .eq('id', conversationId);

  if (error) throw new Error(`updateConversationIntent failed: ${error.message}`);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(params: SaveMessageParams): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    tenant_id: params.tenantId,
    conversation_id: params.conversationId,
    phone: params.phone,
    role: params.role,
    content: params.content,
    message_type: params.messageType,
    wa_message_id: params.waMessageId ?? null,
  });

  if (error) throw new Error(`saveMessage failed: ${error.message}`);
}

export async function getRecentMessages(
  conversationId: string,
  limit: number,
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentMessages failed: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>)
    .reverse()
    .map((row) => ({
      id: row['id'] as string,
      role: row['role'] as StoredMessage['role'],
      content: row['content'] as string,
      createdAt: row['created_at'] as string,
    }));
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function upsertLead(tenantId: string, phone: string, intent?: string): Promise<void> {
  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    phone_number: phone,
    last_contact_at: new Date().toISOString(),
  };
  if (intent) payload['intent_detected'] = intent;

  const { error } = await supabase
    .from('leads')
    .upsert(payload, { onConflict: 'tenant_id,phone_number', ignoreDuplicates: false });

  if (error) throw new Error(`upsertLead failed: ${error.message}`);
}
