// ─── Mock all external dependencies before any import ────────────────────────

const mockGetTenantConfig = jest.fn();
const mockUpsertLead = jest.fn();
const mockGetOrCreateConversation = jest.fn();
const mockUpdateConversationIntent = jest.fn();
const mockSaveMessage = jest.fn();
const mockGetRecentMessages = jest.fn();

jest.mock('../src/services/supabase', () => ({
  getTenantConfigByPhoneNumberId: mockGetTenantConfig,
  upsertLead: mockUpsertLead,
  getOrCreateConversation: mockGetOrCreateConversation,
  updateConversationIntent: mockUpdateConversationIntent,
  saveMessage: mockSaveMessage,
  getRecentMessages: mockGetRecentMessages,
  supabase: { from: jest.fn() },
  updateConversationMode: jest.fn(),
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();

jest.mock('../src/services/redis', () => ({
  getRedisClient: jest.fn(() =>
    Promise.resolve({ get: mockRedisGet, set: mockRedisSet }),
  ),
  createBullConnection: jest.fn(() => ({ on: jest.fn() })),
}));

const mockGetSession = jest.fn();
const mockSetSession = jest.fn();

jest.mock('../src/services/session/sessionManager', () => ({
  getSession: mockGetSession,
  setSession: mockSetSession,
}));

const mockTranscribeAudio = jest.fn();
jest.mock('../src/services/audio/transcriber', () => ({
  transcribeAudio: mockTranscribeAudio,
}));

const mockSimulateTyping = jest.fn();
jest.mock('../src/services/whatsapp/typingSimulator', () => ({
  simulateTyping: mockSimulateTyping,
}));

const mockSendText = jest.fn();
jest.mock('../src/services/whatsapp/sender', () => ({
  sendText: mockSendText,
}));

const mockClassifyIntent = jest.fn();
jest.mock('../src/services/ai/intentClassifier', () => ({
  classifyIntent: mockClassifyIntent,
}));

const mockGenerateResponse = jest.fn();
jest.mock('../src/services/ai/chatEngine', () => ({
  generateResponse: mockGenerateResponse,
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));

import { processMessageJob } from '../src/services/queue/messageProcessor';
import { buildTenantConfig } from './helpers/factories';
import type { Job } from 'bullmq';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(data: unknown): Job {
  return { data } as unknown as Job;
}

const BASE_TENANT = buildTenantConfig();

const BASE_CONVERSATION = {
  id: 'conv-uuid-1',
  tenantId: 'tenant-uuid-1',
  phone: '521234567890',
  mode: 'ai' as const,
  status: 'active' as const,
  primaryIntent: null,
  startedAt: new Date().toISOString(),
  endedAt: null,
};

const TEXT_JOB_DATA = {
  tenantId: 'phone-number-id-123',
  parsedMessage: {
    type: 'text' as const,
    waMessageId: 'wamid.test123',
    from: '521234567890',
    text: 'Hola, quiero información',
    phoneNumberId: 'phone-number-id-123',
    timestamp: 1700000000,
  },
};

function setupDefaultMocks() {
  mockGetTenantConfig.mockResolvedValue(BASE_TENANT);
  mockRedisGet.mockResolvedValue(null); // no dedup
  mockRedisSet.mockResolvedValue('OK');
  mockSimulateTyping.mockResolvedValue(undefined);
  mockUpsertLead.mockResolvedValue(undefined);
  mockGetOrCreateConversation.mockResolvedValue(BASE_CONVERSATION);
  mockGetRecentMessages.mockResolvedValue([]);
  mockClassifyIntent.mockResolvedValue({ intent: 'ventas', confidence: 0.9 });
  mockUpdateConversationIntent.mockResolvedValue(undefined);
  mockGenerateResponse.mockResolvedValue('Claro, te puedo ayudar con eso.');
  mockSaveMessage.mockResolvedValue(undefined);
  mockGetSession.mockResolvedValue(null);
  mockSetSession.mockResolvedValue(undefined);
  mockSendText.mockResolvedValue(undefined);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processMessageJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ─── Complete AI pipeline ──────────────────────────────────────────────────

  it('runs the complete AI pipeline for a text message', async () => {
    await processMessageJob(makeJob(TEXT_JOB_DATA));

    expect(mockGetTenantConfig).toHaveBeenCalledWith('phone-number-id-123');
    expect(mockRedisGet).toHaveBeenCalledWith('dedup:wamid.test123');
    expect(mockRedisSet).toHaveBeenCalledWith('dedup:wamid.test123', '1', 300);
    expect(mockSimulateTyping).toHaveBeenCalled();
    expect(mockUpsertLead).toHaveBeenCalledWith('tenant-uuid-1', '521234567890');
    expect(mockGetOrCreateConversation).toHaveBeenCalledWith('tenant-uuid-1', '521234567890');
    expect(mockGetRecentMessages).toHaveBeenCalledWith('conv-uuid-1', 10);
    expect(mockClassifyIntent).toHaveBeenCalledWith(
      'Hola, quiero información',
      BASE_TENANT.enabledIntents,
    );
    expect(mockUpdateConversationIntent).toHaveBeenCalledWith('conv-uuid-1', 'ventas');
    expect(mockGenerateResponse).toHaveBeenCalled();
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
    expect(mockSendText).toHaveBeenCalledWith(
      'phone-number-id-123',
      BASE_TENANT.waAccessToken,
      '521234567890',
      'Claro, te puedo ayudar con eso.',
    );
  });

  it('increments session messageCount from 0 when no prior session', async () => {
    mockGetSession.mockResolvedValue(null);
    await processMessageJob(makeJob(TEXT_JOB_DATA));
    expect(mockSetSession).toHaveBeenCalledWith(
      'tenant-uuid-1',
      '521234567890',
      expect.objectContaining({ messageCount: 1 }),
    );
  });

  it('increments session messageCount when prior session exists', async () => {
    mockGetSession.mockResolvedValue({ conversationId: 'conv-uuid-1', lastActivity: 0, messageCount: 5 });
    await processMessageJob(makeJob(TEXT_JOB_DATA));
    expect(mockSetSession).toHaveBeenCalledWith(
      'tenant-uuid-1',
      '521234567890',
      expect.objectContaining({ messageCount: 6 }),
    );
  });

  // ─── Tenant not found ─────────────────────────────────────────────────────

  it('returns early when tenant is not found', async () => {
    mockGetTenantConfig.mockResolvedValue(null);
    await processMessageJob(makeJob(TEXT_JOB_DATA));
    expect(mockUpsertLead).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // ─── Deduplication ───────────────────────────────────────────────────────

  it('skips processing when dedup key already exists', async () => {
    mockRedisGet.mockResolvedValue('1');
    await processMessageJob(makeJob(TEXT_JOB_DATA));
    expect(mockSimulateTyping).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // ─── Human mode ──────────────────────────────────────────────────────────

  it('saves user message but skips AI response in human mode', async () => {
    mockGetOrCreateConversation.mockResolvedValue({ ...BASE_CONVERSATION, mode: 'human' });

    await processMessageJob(makeJob(TEXT_JOB_DATA));

    expect(mockSaveMessage).toHaveBeenCalledTimes(1);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'Hola, quiero información' }),
    );
    expect(mockGenerateResponse).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // ─── Hybrid mode ─────────────────────────────────────────────────────────

  it('runs full AI pipeline in hybrid mode', async () => {
    mockGetOrCreateConversation.mockResolvedValue({ ...BASE_CONVERSATION, mode: 'hybrid' });

    await processMessageJob(makeJob(TEXT_JOB_DATA));

    expect(mockGenerateResponse).toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalled();
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
  });

  // ─── Audio message ────────────────────────────────────────────────────────

  it('transcribes audio and processes as text', async () => {
    mockTranscribeAudio.mockResolvedValue('Quiero hacer un pedido');

    const audioJob = {
      tenantId: 'phone-number-id-123',
      parsedMessage: {
        type: 'audio' as const,
        waMessageId: 'wamid.audio123',
        from: '521234567890',
        audioId: 'audio-media-id-456',
        phoneNumberId: 'phone-number-id-123',
        timestamp: 1700000000,
      },
    };

    await processMessageJob(makeJob(audioJob));

    expect(mockTranscribeAudio).toHaveBeenCalledWith('audio-media-id-456', BASE_TENANT.waAccessToken);
    expect(mockClassifyIntent).toHaveBeenCalledWith('Quiero hacer un pedido', BASE_TENANT.enabledIntents);
    expect(mockSendText).toHaveBeenCalled();
  });

  it('returns early when audio transcription fails', async () => {
    mockTranscribeAudio.mockRejectedValue(new Error('Transcription failed'));

    const audioJob = {
      tenantId: 'phone-number-id-123',
      parsedMessage: {
        type: 'audio' as const,
        waMessageId: 'wamid.audio123',
        from: '521234567890',
        audioId: 'audio-media-id-456',
        phoneNumberId: 'phone-number-id-123',
        timestamp: 1700000000,
      },
    };

    await processMessageJob(makeJob(audioJob));

    expect(mockSendText).not.toHaveBeenCalled();
  });

  // ─── Unsupported message type ─────────────────────────────────────────────

  it('returns early for unsupported message type', async () => {
    const unsupportedJob = {
      tenantId: 'phone-number-id-123',
      parsedMessage: {
        type: 'unsupported' as unknown as 'text',
        waMessageId: 'wamid.img',
        from: '521234567890',
        text: '',
        phoneNumberId: 'phone-number-id-123',
        timestamp: 1700000000,
      },
    };

    await processMessageJob(makeJob(unsupportedJob));

    expect(mockSimulateTyping).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // ─── OpenAI timeout / error ───────────────────────────────────────────────

  it('saves fallback response when generateResponse returns a fallback string', async () => {
    const fallback = 'Estoy tardando más de lo esperado. Intenta en un momento 🙏';
    mockGenerateResponse.mockResolvedValue(fallback);

    await processMessageJob(makeJob(TEXT_JOB_DATA));

    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      '521234567890',
      fallback,
    );
    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
  });
});
