import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { TenantConfig } from '../types';

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
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

// ─── Lead ─────────────────────────────────────────────────────────────────────

export async function upsertLead(
  tenantId: string,
  phone: string,
  intent: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('leads')
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: phone,
        intent_detected: intent,
        last_contact_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,phone_number', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) throw new Error(`upsertLead failed: ${error.message}`);
  return data.id as string;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  tenantId: string,
  phone: string,
  defaultMode: TenantConfig['conversationMode'],
): Promise<{ id: string; mode: TenantConfig['conversationMode'] }> {
  // Look for an existing active conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, mode')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      mode: existing.mode as TenantConfig['conversationMode'],
    };
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ tenant_id: tenantId, phone, mode: defaultMode })
    .select('id, mode')
    .single();

  if (error) throw new Error(`getOrCreateConversation failed: ${error.message}`);
  return {
    id: created.id as string,
    mode: created.mode as TenantConfig['conversationMode'],
  };
}

export async function setConversationMode(
  conversationId: string,
  mode: TenantConfig['conversationMode'],
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ mode, status: mode === 'human' ? 'handoff' : 'active' })
    .eq('id', conversationId);

  if (error) throw new Error(`setConversationMode failed: ${error.message}`);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(
  tenantId: string,
  conversationId: string,
  phone: string,
  role: 'user' | 'assistant',
  content: string,
  messageType: 'text' | 'audio',
  waMessageId?: string,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    phone,
    role,
    content,
    message_type: messageType,
    wa_message_id: waMessageId ?? null,
  });

  if (error) throw new Error(`saveMessage failed: ${error.message}`);
}

export interface DbMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getRecentMessages(
  conversationId: string,
  limit = 10,
): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentMessages failed: ${error.message}`);
  // Reverse so oldest first (natural conversation order for the LLM)
  return ((data ?? []) as DbMessage[]).reverse();
}
