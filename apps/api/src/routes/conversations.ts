import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase';
import { updateConversationMode } from '../services/supabase';
import { tenantAuth } from '../middleware/tenantAuth';
import { logger } from '../utils/logger';

export const conversationsRouter = Router();

conversationsRouter.use(tenantAuth);

// ─── GET /api/v1/conversations ────────────────────────────────────────────────

conversationsRouter.get(
  '/api/v1/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? 1), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20), 10) || 20));
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact' })
        .eq('tenant_id', req.tenantId)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      res.json({ data: data ?? [], total: count ?? 0, page, limit });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/v1/conversations/:id/messages ───────────────────────────────────

conversationsRouter.get(
  '/api/v1/conversations/:id/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query['limit'] ?? 50), 10) || 50));

      // Verify ownership
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', req.params['id'])
        .eq('tenant_id', req.tenantId)
        .maybeSingle();

      if (!conv) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select('id, role, content, message_type, created_at')
        .eq('conversation_id', req.params['id'])
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw new Error(error.message);

      res.json({ data: data ?? [], conversationId: req.params['id'] });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/v1/conversations/:id/mode ────────────────────────────────────

const modeSchema = z.object({
  mode: z.enum(['ai', 'human', 'hybrid']),
});

conversationsRouter.patch(
  '/api/v1/conversations/:id/mode',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = modeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      // Verify ownership
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', req.params['id'])
        .eq('tenant_id', req.tenantId)
        .maybeSingle();

      if (!conv) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const { mode } = parsed.data;
      await updateConversationMode(req.params['id']!, mode);

      logger.info(
        { conversationId: req.params['id'], mode, tenantId: req.tenantId },
        'conversation_mode_changed',
      );

      res.json({ conversationId: req.params['id']!, mode });
    } catch (err) {
      next(err);
    }
  },
);
