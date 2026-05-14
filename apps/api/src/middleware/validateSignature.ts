import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

export function validateSignature(req: Request, res: Response, next: NextFunction): void {
  if (config.NODE_ENV !== 'production') {
    next();
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) {
    logger.warn({ ip: req.ip }, 'webhook_missing_signature');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  if (!req.rawBody) {
    logger.warn('webhook_missing_raw_body');
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }

  const expected = `sha256=${createHmac('sha256', config.META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex')}`;

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    logger.warn({ ip: req.ip }, 'webhook_invalid_signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}
