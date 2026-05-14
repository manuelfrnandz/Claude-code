import { Router, Request, Response } from 'express';

export const routes = Router();

// Health check — no DB, no Redis, always fast
routes.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});
