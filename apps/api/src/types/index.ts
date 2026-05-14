import { Request } from 'express';

// Augment Express Request with our custom properties
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      tenantId?: string;
    }
  }
}

export type { Request };
