import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase';
import { tenantAuth } from '../middleware/tenantAuth';

export const leadsRouter = Router();

leadsRouter.use(tenantAuth);

// ─── GET /api/v1/leads ────────────────────────────────────────────────────────

leadsRouter.get('/api/v1/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20), 10) || 20));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', req.tenantId)
      .order('last_contact_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    res.json({ data: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/leads/:id ──────────────────────────────────────────────────

const updateLeadSchema = z.object({
  stage: z.enum(['nuevo', 'calificado', 'convertido', 'perdido']).optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

leadsRouter.patch('/api/v1/leads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(parsed.data)
      .eq('id', req.params['id'])
      .eq('tenant_id', req.tenantId) // ownership check
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});
