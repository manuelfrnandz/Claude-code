import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

export const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

export const setupRateLimiter = rateLimit({
  windowMs: 3_600_000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many setup attempts' },
});

export function setupIpGuard(req: Request, res: Response, next: NextFunction): void {
  const allowed = config.ALLOWED_SETUP_IPS.trim();
  if (config.NODE_ENV !== 'production' || !allowed) {
    next();
    return;
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  const list = allowed.split(',').map((s) => s.trim());

  if (!list.includes(ip)) {
    logger.warn({ ip }, 'setup_blocked_ip');
    res.status(403).json({ error: 'IP not allowed' });
    return;
  }

  next();
}
