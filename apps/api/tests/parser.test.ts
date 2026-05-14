import { parseWebhookBody } from '../src/services/whatsapp/parser';
import { buildWhatsAppPayload } from './helpers/factories';

const UNSUPPORTED_TYPES = [
  'image',
  'video',
  'document',
  'sticker',
  'location',
  'contacts',
  'reaction',
  'unsupported',
  'deleted',
];

describe('parseWebhookBody', () => {
  // ─── Text messages ───────────────────────────────────────────────────────────

  it('parses a valid text message', () => {
    const payload = buildWhatsAppPayload('text');
    const result = parseWebhookBody(payload);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'text',
      waMessageId: 'wamid.test123',
      from: '521234567890',
      text: 'Hola, quiero información',
      phoneNumberId: 'phone-number-id-123',
      timestamp: 1700000000,
    });
  });

  it('parses a text message with empty body as empty string', () => {
    const payload = buildWhatsAppPayload('text', { text: { body: '' } });
    const result = parseWebhookBody(payload);

    expect(result[0]).toMatchObject({ type: 'text', text: '' });
  });

  // ─── Audio messages ──────────────────────────────────────────────────────────

  it('parses a valid audio message', () => {
    const payload = buildWhatsAppPayload('audio');
    const result = parseWebhookBody(payload);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'audio',
      waMessageId: 'wamid.test123',
      from: '521234567890',
      audioId: 'audio-media-id-456',
      phoneNumberId: 'phone-number-id-123',
    });
  });

  // ─── Unsupported message types ───────────────────────────────────────────────

  UNSUPPORTED_TYPES.forEach((msgType) => {
    it(`returns unsupported for type=${msgType} without throwing`, () => {
      const payload = buildWhatsAppPayload(msgType);
      expect(() => parseWebhookBody(payload)).not.toThrow();
      const result = parseWebhookBody(payload);
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('unsupported');
    });
  });

  // ─── Multiple messages in one payload ────────────────────────────────────────

  it('parses multiple messages from a single payload', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'phone-number-id-123' },
                messages: [
                  {
                    id: 'wamid.001',
                    from: '521234567890',
                    timestamp: '1700000001',
                    type: 'text',
                    text: { body: 'Primero' },
                  },
                  {
                    id: 'wamid.002',
                    from: '521234567891',
                    timestamp: '1700000002',
                    type: 'audio',
                    audio: { id: 'audio-002' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = parseWebhookBody(payload);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('text');
    expect(result[1]?.type).toBe('audio');
  });

  // ─── Edge / invalid payloads ─────────────────────────────────────────────────

  it('returns empty array when object is not whatsapp_business_account', () => {
    const result = parseWebhookBody({ object: 'something_else' });
    expect(result).toEqual([]);
  });

  it('returns empty array for null payload', () => {
    const result = parseWebhookBody(null);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty object', () => {
    const result = parseWebhookBody({});
    expect(result).toEqual([]);
  });

  it('returns unsupported when payload is a plain string', () => {
    const result = parseWebhookBody('not-an-object');
    expect(result).toEqual([]);
  });

  it('handles missing messages array gracefully', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { metadata: { phone_number_id: 'pid' } } }] }],
    };
    const result = parseWebhookBody(payload);
    expect(result).toEqual([]);
  });

  it('returns unsupported for deeply malformed message without throwing', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pid' },
                messages: [null],
              },
            },
          ],
        },
      ],
    };
    expect(() => parseWebhookBody(payload)).not.toThrow();
    const result = parseWebhookBody(payload);
    expect(result[0]?.type).toBe('unsupported');
  });
});
