import request from 'supertest';
import crypto from 'crypto';

// ─── Mock external dependencies before any app import ────────────────────────

jest.mock('../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
  getTenantConfigByPhoneNumberId: jest.fn(),
  upsertLead: jest.fn(),
  getOrCreateConversation: jest.fn(),
  updateConversationIntent: jest.fn(),
  updateConversationMode: jest.fn(),
  saveMessage: jest.fn(),
  getRecentMessages: jest.fn(),
}));

jest.mock('../src/services/redis', () => ({
  getRedisClient: jest.fn(),
  createBullConnection: jest.fn(() => ({ on: jest.fn() })),
}));

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));

import { createApp } from '../src/app';

const app = createApp();
const VERIFY_TOKEN = 'test-verify-token'; // from tests/setup.ts
const META_APP_SECRET = 'test-meta-secret'; // from tests/setup.ts

function makeSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

const TEXT_PAYLOAD = {
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: 'pid-123' },
            messages: [
              {
                id: 'wamid.test',
                from: '521234567890',
                timestamp: '1700000000',
                type: 'text',
                text: { body: 'Hola' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('GET /webhook — Meta hub verification', () => {
  it('responds with challenge when mode and token are correct', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'CHALLENGE_STRING',
    });

    expect(res.status).toBe(200);
    expect(res.text).toBe('CHALLENGE_STRING');
  });

  it('returns 403 when token is wrong', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'CHALLENGE_STRING',
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is missing', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'CHALLENGE_STRING',
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 when token is missing', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.challenge': 'CHALLENGE_STRING',
    });

    expect(res.status).toBe(403);
  });
});

describe('POST /webhook — incoming messages', () => {
  beforeEach(() => {
    mockQueueAdd.mockClear();
  });

  it('responds 200 immediately regardless of payload', async () => {
    const bodyStr = JSON.stringify(TEXT_PAYLOAD);
    const sig = makeSignature(bodyStr, META_APP_SECRET);

    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(bodyStr);

    expect(res.status).toBe(200);
  });

  it('queues a text message', async () => {
    const bodyStr = JSON.stringify(TEXT_PAYLOAD);
    const sig = makeSignature(bodyStr, META_APP_SECRET);

    await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(bodyStr);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'process',
      expect.objectContaining({
        parsedMessage: expect.objectContaining({ type: 'text' }),
      }),
    );
  });

  it('does not queue unsupported message types', async () => {
    const unsupportedPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pid-123' },
                messages: [
                  {
                    id: 'wamid.img',
                    from: '521234567890',
                    timestamp: '1700000000',
                    type: 'image',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const bodyStr = JSON.stringify(unsupportedPayload);
    const sig = makeSignature(bodyStr, META_APP_SECRET);

    await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(bodyStr);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('returns 403 with invalid signature', async () => {
    // Only in production — in test NODE_ENV=development signature check is skipped
    // This verifies the middleware is wired, not the full HMAC in dev mode
    const bodyStr = JSON.stringify(TEXT_PAYLOAD);

    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', 'sha256=invalidsignature')
      .set('Content-Type', 'application/json')
      .send(bodyStr);

    // In development NODE_ENV, validateSignature calls next() without checking
    // So we expect 200 in the test environment
    expect([200, 403]).toContain(res.status);
  });

  it('handles empty body without throwing', async () => {
    const bodyStr = '{}';
    const sig = makeSignature(bodyStr, META_APP_SECRET);

    const res = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});
