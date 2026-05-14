import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error({ err: err.message, stack: err.stack, url: req.url }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
