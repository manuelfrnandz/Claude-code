import type { TenantConfig } from '../../src/types';

export function buildWhatsAppPayload(
  type: string,
  overrides: Record<string, unknown> = {},
): unknown {
  const base = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone-number-id-123' },
              messages: [
                {
                  id: 'wamid.test123',
                  from: '521234567890',
                  timestamp: '1700000000',
                  type,
                  ...(type === 'text' ? { text: { body: 'Hola, quiero información' } } : {}),
                  ...(type === 'audio' ? { audio: { id: 'audio-media-id-456' } } : {}),
                  ...overrides,
                },
              ],
            },
          },
        ],
      },
    ],
  };
  return base;
}

export function buildTenantConfig(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    id: 'config-uuid-1',
    tenantId: 'tenant-uuid-1',
    waPhoneNumberId: 'phone-number-id-123',
    waAccessToken: 'EAAtest123',
    botName: 'TestBot',
    businessName: 'Test Business',
    businessDescription: 'A test business description',
    personality: 'amigable y profesional',
    language: 'español',
    systemPrompt: null,
    catalogData: null,
    faqData: null,
    schedule: null,
    location: null,
    phoneHuman: null,
    notificationEmail: null,
    welcomeMessage: '¡Hola! ¿En qué te puedo ayudar?',
    escalationTriggers: [],
    conversationMode: 'ai',
    enabledIntents: ['ventas', 'soporte', 'citas'],
    ordersEnabled: false,
    appointmentsEnabled: false,
    ...overrides,
  };
}

export function buildMessageJob(overrides: Record<string, unknown> = {}): unknown {
  return {
    tenantId: 'phone-number-id-123',
    parsedMessage: {
      type: 'text',
      waMessageId: 'wamid.test123',
      from: '521234567890',
      text: 'Hola, quiero información',
      phoneNumberId: 'phone-number-id-123',
      timestamp: 1700000000,
      ...overrides,
    },
  };
}
