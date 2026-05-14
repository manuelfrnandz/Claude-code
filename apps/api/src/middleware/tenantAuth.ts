import { Request, Response, NextFunction } from 'express';

export function tenantAuth(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    res.status(401).json({ error: 'Missing X-Tenant-ID header' });
    return;
  }
  req.tenantId = tenantId;
  next();
}
