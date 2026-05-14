import { Job } from 'bullmq';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { getRedisClient } from '../redis';
import { getSession, setSession } from '../session/sessionManager';
import { transcribeAudio } from '../audio/transcriber';
import { simulateTyping } from '../whatsapp/typingSimulator';
import { sendText } from '../whatsapp/sender';
import { classifyIntent } from '../ai/intentClassifier';
import { buildSystemPrompt } from '../ai/promptBuilder';
import { generateResponse } from '../ai/chatEngine';
import {
  getTenantConfigByPhoneNumberId,
  upsertLead,
  getOrCreateConversation,
  saveMessage,
  getRecentMessages,
} from '../supabase';
import type { MessageJobData } from './messageQueue';

const DEDUP_TTL = 300; // seconds

export async function processMessageJob(job: Job<MessageJobData>): Promise<void> {
  const { tenantId: phoneNumberId, parsedMessage: msg } = job.data;

  // ── 1. Load tenant ────────────────────────────────────────────────────────
  const tenant = await getTenantConfigByPhoneNumberId(phoneNumberId);
  if (!tenant) {
    logger.warn({ phoneNumberId }, 'tenant_not_found');
    return;
  }

  // ── 2. Dedup — skip if we already processed this WhatsApp message id ──────
  const redis = await getRedisClient();
  const dedupKey = `dedup:${msg.waMessageId}`;
  const seen = await redis.get(dedupKey);
  if (seen) {
    logger.debug({ waMessageId: msg.waMessageId }, 'message_dedup_skipped');
    return;
  }
  await redis.set(dedupKey, '1', DEDUP_TTL);

  // ── 3. Rate limit — max 10 messages / minute / phone ─────────────────────
  const rlKey = `ratelimit:${tenant.tenantId}:${msg.from}`;
  const count = await redis.incr(rlKey);
  if (count === 1) {
    // First hit in this window — set expiry (incr doesn't set TTL)
    await redis.set(rlKey, String(count), 60);
  }
  if (count > 10) {
    logger.debug({ from: msg.from, count }, 'rate_limit_exceeded');
    return;
  }

  // ── 4. Resolve text content (transcribe audio if needed) ──────────────────
  let text: string;
  let messageType: 'text' | 'audio';

  if (msg.type === 'audio') {
    try {
      text = await transcribeAudio(msg.audioId, tenant.waAccessToken);
      messageType = 'audio';
    } catch (err) {
      logger.warn({ err: (err as Error).message, from: msg.from }, 'audio_transcription_failed');
      return;
    }
  } else {
    text = msg.text;
    messageType = 'text';
  }

  // ── 5. Typing indicator (mark as read + brief delay) ──────────────────────
  await simulateTyping(phoneNumberId, tenant.waAccessToken, msg.waMessageId);

  // ── 6. Upsert lead ────────────────────────────────────────────────────────
  const { intent } = await classifyIntent(text, tenant.enabledIntents);
  await upsertLead(tenant.tenantId, msg.from, intent);

  // ── 7. Get or create conversation; read per-conversation mode ─────────────
  const conversation = await getOrCreateConversation(
    tenant.tenantId,
    msg.from,
    tenant.conversationMode,
  );

  // ── 8. Save user message to Supabase ──────────────────────────────────────
  await saveMessage(
    tenant.tenantId,
    conversation.id,
    msg.from,
    'user',
    text,
    messageType,
    msg.waMessageId,
  );

  // ── 9. Conversation mode routing ──────────────────────────────────────────
  if (conversation.mode === 'human') {
    logger.info({ conversationId: conversation.id, from: msg.from }, 'conversation_human_mode_skip');
    return;
  }

  if (conversation.mode === 'hybrid') {
    logger.info(
      { tenantId: tenant.tenantId, phone: msg.from, conversationId: conversation.id },
      'hybrid_conversation_active',
    );
    // Continues to AI pipeline — supervisor can see the conversation live
  }

  // ── 10. Load recent messages for context ──────────────────────────────────
  const history = await getRecentMessages(conversation.id);

  // ── 11. Build prompt + generate response ──────────────────────────────────
  const systemPrompt = buildSystemPrompt(tenant);
  const responseText = await generateResponse(history, systemPrompt, tenant.tenantId);

  // ── 12. Persist assistant message ─────────────────────────────────────────
  await saveMessage(tenant.tenantId, conversation.id, msg.from, 'assistant', responseText, 'text');

  // ── 13. Update session ────────────────────────────────────────────────────
  const prevSession = await getSession(tenant.tenantId, msg.from);
  await setSession(tenant.tenantId, msg.from, {
    conversationId: conversation.id,
    lastActivity: Date.now(),
    messageCount: (prevSession?.messageCount ?? 0) + 1,
  });

  // ── 14. Send reply to WhatsApp ────────────────────────────────────────────
  await sendText(phoneNumberId, tenant.waAccessToken, msg.from, responseText);

  logger.info(
    {
      tenantId: tenant.tenantId,
      conversationId: conversation.id,
      from: msg.from,
      intent,
      mode: conversation.mode,
    },
    'message_pipeline_complete',
  );
}
