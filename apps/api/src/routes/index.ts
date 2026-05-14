import { Router, Request, Response } from 'express';
import { webhookRouter } from './webhook';
import { tenantsRouter } from './tenants';
import { leadsRouter } from './leads';
import { conversationsRouter } from './conversations';
import { statsRouter } from './stats';

export const routes = Router();

// Health check — no DB, no Redis, always fast
routes.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

routes.use('/', webhookRouter);
routes.use('/', tenantsRouter);   // includes /api/v1/setup (own auth) + tenants (tenantAuth)
routes.use('/', leadsRouter);
routes.use('/', conversationsRouter);
routes.use('/', statsRouter);
