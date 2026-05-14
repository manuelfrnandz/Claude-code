import { Job } from 'bullmq';
import { logger } from '../../utils/logger';
import { getRedisClient } from '../redis';
import { getSession, setSession } from '../session/sessionManager';
import { transcribeAudio } from '../audio/transcriber';
import { simulateTyping } from '../whatsapp/typingSimulator';
import { sendText } from '../whatsapp/sender';
import { classifyIntent } from '../ai/intentClassifier';
import { buildSystemPrompt } from '../ai/promptBuilder';
import { generateResponse, type ChatMessage } from '../ai/chatEngine';
import {
  getTenantConfigByPhoneNumberId,
  upsertLead,
  getOrCreateConversation,
  updateConversationIntent,
  saveMessage,
  getRecentMessages,
} from '../supabase';
import type { MessageJobData } from './messageQueue';

const DEDUP_TTL = 300;

export async function processMessageJob(job: Job<MessageJobData>): Promise<void> {
  const { tenantId: phoneNumberId, parsedMessage: msg } = job.data;

  // ── PASO 1: Load tenant ───────────────────────────────────────────────────
  const tenantConfig = await getTenantConfigByPhoneNumberId(phoneNumberId);
  if (!tenantConfig) {
    logger.warn({ phoneNumberId }, 'tenant_not_found');
    return;
  }

  const { tenantId, waAccessToken } = tenantConfig;

  // ── PASO 2: Dedup ─────────────────────────────────────────────────────────
  const redis = await getRedisClient();
  const dedupKey = `dedup:${msg.waMessageId}`;
  if (await redis.get(dedupKey)) {
    logger.debug({ waMessageId: msg.waMessageId }, 'duplicate_message');
    return;
  }
  await redis.set(dedupKey, '1', DEDUP_TTL);

  // ── PASO 3: Resolve text content ──────────────────────────────────────────
  let text: string;
  let messageType: 'text' | 'audio';

  switch (msg.type) {
    case 'audio':
      try {
        text = await transcribeAudio(msg.audioId, waAccessToken);
        messageType = 'audio';
      } catch (err) {
        logger.warn({ err: (err as Error).message, from: msg.from }, 'audio_transcription_failed');
        return;
      }
      break;

    case 'text':
      text = msg.text;
      messageType = 'text';
      break;

    default:
      logger.debug({ type: (msg as { type: string }).type }, 'unsupported_message_type');
      return;
  }

  // ── PASO 4: Typing indicator ──────────────────────────────────────────────
  await simulateTyping(phoneNumberId, waAccessToken, msg.from, msg.waMessageId);

  // ── PASO 5: Upsert lead ───────────────────────────────────────────────────
  await upsertLead(tenantId, msg.from);

  // ── PASO 6: Get or create conversation ───────────────────────────────────
  const conversation = await getOrCreateConversation(tenantId, msg.from);

  // ── PASO 7: Load recent messages ─────────────────────────────────────────
  const recentMessages = await getRecentMessages(conversation.id, 10);

  // ── PASO 8: Mode routing ──────────────────────────────────────────────────
  if (conversation.mode === 'human') {
    await saveMessage({
      tenantId,
      conversationId: conversation.id,
      phone: msg.from,
      role: 'user',
      content: text,
      messageType,
      waMessageId: msg.waMessageId,
    });
    logger.info({ conversationId: conversation.id, from: msg.from }, 'conversation_human_mode_skip');
    return;
  }

  if (conversation.mode === 'hybrid') {
    logger.info({ tenantId, phone: msg.from, conversationId: conversation.id }, 'hybrid_active');
  }

  // ── PASO 9: Classify intent ───────────────────────────────────────────────
  const { intent } = await classifyIntent(text, tenantConfig.enabledIntents);
  await updateConversationIntent(conversation.id, intent);

  // ── PASO 10: Build system prompt ──────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(tenantConfig);

  // ── PASO 11: Generate AI response ────────────────────────────────────────
  const chatHistory: ChatMessage[] = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const responseText = await generateResponse(chatHistory, systemPrompt, tenantId);

  // ── PASO 12: Persist user + assistant messages ────────────────────────────
  await saveMessage({
    tenantId,
    conversationId: conversation.id,
    phone: msg.from,
    role: 'user',
    content: text,
    messageType,
    waMessageId: msg.waMessageId,
  });
  await saveMessage({
    tenantId,
    conversationId: conversation.id,
    phone: msg.from,
    role: 'assistant',
    content: responseText,
    messageType: 'text',
  });

  // ── PASO 13: Update session ───────────────────────────────────────────────
  const prevSession = await getSession(tenantId, msg.from);
  await setSession(tenantId, msg.from, {
    conversationId: conversation.id,
    lastActivity: Date.now(),
    messageCount: (prevSession?.messageCount ?? 0) + 1,
  });

  // ── PASO 14: Send reply ───────────────────────────────────────────────────
  await sendText(phoneNumberId, waAccessToken, msg.from, responseText);

  logger.info(
    { tenantId, conversationId: conversation.id, from: msg.from, intent, mode: conversation.mode },
    'message_pipeline_complete',
  );
}
