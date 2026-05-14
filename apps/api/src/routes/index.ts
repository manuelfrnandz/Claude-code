import { Router, Request, Response } from 'express';
import { webhookRouter } from './webhook';

export const routes = Router();

// Health check — no DB, no Redis, always fast
routes.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

routes.use('/', webhookRouter);
