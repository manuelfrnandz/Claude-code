import request from 'supertest';

// ─── Mock external dependencies before any app import ────────────────────────

jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
  updateConversationMode: jest.fn(),
  getTenantConfigByPhoneNumberId: jest.fn(),
  upsertLead: jest.fn(),
  getOrCreateConversation: jest.fn(),
  updateConversationIntent: jest.fn(),
  saveMessage: jest.fn(),
  getRecentMessages: jest.fn(),
}));

jest.mock('../src/services/redis', () => ({
  getRedisClient: jest.fn(),
  createBullConnection: jest.fn(() => ({ on: jest.fn() })),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));

import { createApp } from '../src/app';
import { supabase, updateConversationMode } from '../src/services/supabase';

// ADMIN_SECRET is set in tests/setup.ts
const ADMIN_SECRET = 'test-admin-secret-32-chars-minimum!!';

const app = createApp();

// ─── Helper to build a chainable Supabase mock ───────────────────────────────

function makeChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const resolved = Promise.resolve(result);
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnValue(resolved), // list queries end here
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

const supabaseMock = supabase as jest.Mocked<typeof supabase>;

// ─── Tenants ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/tenants/:id/config', () => {
  it('returns 401 without X-Tenant-ID', async () => {
    const res = await request(app).get('/api/v1/tenants/some-id/config');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/X-Tenant-ID/);
  });

  it('returns 200 with existing config', async () => {
    const fakeConfig = { id: 'cfg-1', tenant_id: 't-1', bot_name: 'TestBot' };
    (supabaseMock.from as jest.Mock).mockReturnValue(makeChain({ data: fakeConfig, error: null }));

    const res = await request(app)
      .get('/api/v1/tenants/t-1/config')
      .set('X-Tenant-ID', 't-1');

    expect(res.status).toBe(200);
    expect(res.body.bot_name).toBe('TestBot');
  });

  it('returns 404 when config does not exist', async () => {
    (supabaseMock.from as jest.Mock).mockReturnValue(makeChain({ data: null, error: { message: 'not found' } }));

    const res = await request(app)
      .get('/api/v1/tenants/t-999/config')
      .set('X-Tenant-ID', 't-999');

    expect(res.status).toBe(404);
  });
});

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/setup', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/api/v1/setup')
      .send({ business_name: 'Biz', email: 'a@a.com' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing email)', async () => {
    const res = await request(app)
      .post('/api/v1/setup')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ business_name: 'Biz' });

    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    (supabaseMock.from as jest.Mock).mockReturnValue(
      makeChain({ data: { id: 'existing-id' }, error: null }),
    );

    const res = await request(app)
      .post('/api/v1/setup')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ business_name: 'Biz', email: 'dup@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/);
  });

  it('returns 201 on successful setup', async () => {
    const fromMock = supabaseMock.from as jest.Mock;

    fromMock
      // duplicate check — no existing tenant
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      // insert tenant
      .mockReturnValueOnce(makeChain({ data: { id: 'new-tenant-id' }, error: null }))
      // insert tenant_configs
      .mockReturnValueOnce(makeChain({ data: { id: 'new-config-id' }, error: null }));

    const res = await request(app)
      .post('/api/v1/setup')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ business_name: 'Mi Restaurante', email: 'new@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.tenant_id).toBe('new-tenant-id');
    expect(res.body.config_id).toBe('new-config-id');
  });
});

// ─── Leads ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/leads', () => {
  it('returns 401 without X-Tenant-ID', async () => {
    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(401);
  });

  it('returns 200 with pagination envelope', async () => {
    const leads = [{ id: 'l-1', phone_number: '+521234567890', stage: 'nuevo' }];
    const chain = makeChain({ data: leads, error: null, count: 1 });
    (supabaseMock.from as jest.Mock).mockReturnValue(chain);

    const res = await request(app)
      .get('/api/v1/leads')
      .set('X-Tenant-ID', 't-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });
});

describe('PATCH /api/v1/leads/:id', () => {
  it('returns 400 for invalid stage', async () => {
    const res = await request(app)
      .patch('/api/v1/leads/l-1')
      .set('X-Tenant-ID', 't-1')
      .send({ stage: 'invalid-stage' });

    expect(res.status).toBe(400);
  });

  it('returns 200 with updated lead', async () => {
    const updated = { id: 'l-1', stage: 'calificado', phone_number: '+521234567890' };
    (supabaseMock.from as jest.Mock).mockReturnValue(makeChain({ data: updated, error: null }));

    const res = await request(app)
      .patch('/api/v1/leads/l-1')
      .set('X-Tenant-ID', 't-1')
      .send({ stage: 'calificado' });

    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('calificado');
  });

  it('returns 404 when lead not found or wrong tenant', async () => {
    (supabaseMock.from as jest.Mock).mockReturnValue(makeChain({ data: null, error: { message: 'not found' } }));

    const res = await request(app)
      .patch('/api/v1/leads/l-missing')
      .set('X-Tenant-ID', 't-1')
      .send({ stage: 'calificado' });

    expect(res.status).toBe(404);
  });
});

// ─── Conversations ────────────────────────────────────────────────────────────

describe('GET /api/v1/conversations', () => {
  it('returns 200 with conversation list', async () => {
    const convs = [{ id: 'c-1', phone: '+521234567890', mode: 'ai', status: 'active' }];
    (supabaseMock.from as jest.Mock).mockReturnValue(makeChain({ data: convs, error: null, count: 1 }));

    const res = await request(app)
      .get('/api/v1/conversations')
      .set('X-Tenant-ID', 't-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe('PATCH /api/v1/conversations/:id/mode', () => {
  it('returns 400 for invalid mode', async () => {
    const res = await request(app)
      .patch('/api/v1/conversations/c-1/mode')
      .set('X-Tenant-ID', 't-1')
      .send({ mode: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('returns 200 with updated mode', async () => {
    // ownership check
    (supabaseMock.from as jest.Mock).mockReturnValue(makeChain({ data: { id: 'c-1' }, error: null }));
    (updateConversationMode as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/api/v1/conversations/c-1/mode')
      .set('X-Tenant-ID', 't-1')
      .send({ mode: 'human' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('human');
    expect(res.body.conversationId).toBe('c-1');
  });
});
