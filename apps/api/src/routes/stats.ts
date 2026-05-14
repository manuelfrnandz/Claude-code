import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';
import { tenantAuth } from '../middleware/tenantAuth';

export const statsRouter = Router();

statsRouter.use(tenantAuth);

// ─── GET /api/v1/stats ────────────────────────────────────────────────────────

statsRouter.get('/api/v1/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const [leadsResult, messagesResult, conversationsResult] = await Promise.all([
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString()),
      supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
    ]);

    res.json({
      totalLeads: leadsResult.count ?? 0,
      messagesToday: messagesResult.count ?? 0,
      activeConversations: conversationsResult.count ?? 0,
    });
  } catch (err) {
    next(err);
  }
});
