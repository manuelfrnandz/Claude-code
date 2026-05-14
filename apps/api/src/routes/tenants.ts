import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { supabase, getTenantConfigByPhoneNumberId } from '../services/supabase';
import { tenantAuth } from '../middleware/tenantAuth';
import { setupRateLimiter, setupIpGuard } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

export const tenantsRouter = Router();

// ─── Bearer auth for /setup ───────────────────────────────────────────────────

function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${config.ADMIN_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ─── GET /api/v1/tenants/:id/config ──────────────────────────────────────────

tenantsRouter.get(
  '/api/v1/tenants/:id/config',
  tenantAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabase
        .from('tenant_configs')
        .select('*')
        .eq('tenant_id', req.params['id'])
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Tenant config not found' });
        return;
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /api/v1/tenants/:id/config ──────────────────────────────────────────

const updateConfigSchema = z.object({
  bot_name: z.string().optional(),
  business_name: z.string().optional(),
  business_description: z.string().nullable().optional(),
  personality: z.string().optional(),
  language: z.string().optional(),
  system_prompt: z.string().nullable().optional(),
  catalog_data: z.unknown().optional(),
  faq_data: z.unknown().optional(),
  schedule: z.unknown().optional(),
  location: z.string().nullable().optional(),
  phone_human: z.string().nullable().optional(),
  notification_email: z.string().email().nullable().optional(),
  welcome_message: z.string().nullable().optional(),
  escalation_triggers: z.array(z.string()).optional(),
  conversation_mode: z.enum(['ai', 'human', 'hybrid']).optional(),
  enabled_intents: z.array(z.string()).optional(),
  orders_enabled: z.boolean().optional(),
  appointments_enabled: z.boolean().optional(),
  wa_phone_number_id: z.string().optional(),
  wa_access_token: z.string().optional(),
});

tenantsRouter.put(
  '/api/v1/tenants/:id/config',
  tenantAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const { data, error } = await supabase
        .from('tenant_configs')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('tenant_id', req.params['id'])
        .select()
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Tenant config not found' });
        return;
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/v1/setup ───────────────────────────────────────────────────────

const setupSchema = z.object({
  business_name: z.string().min(1),
  email: z.string().email(),
  bot_name: z.string().optional(),
  wa_phone_number_id: z.string().optional(),
  wa_access_token: z.string().optional(),
  personality: z.string().optional(),
  language: z.string().optional(),
  welcome_message: z.string().optional(),
  phone_human: z.string().optional(),
});

tenantsRouter.post(
  '/api/v1/setup',
  setupRateLimiter,
  setupIpGuard,
  bearerAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';

    try {
      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const { business_name, email, ...configFields } = parsed.data;
      logger.info({ ip, email, ts: new Date().toISOString() }, 'setup_attempt');

      // Check for duplicate email
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // Insert tenant
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ name: business_name, email })
        .select('id')
        .single();

      if (tenantErr || !tenant) {
        throw new Error(`Failed to create tenant: ${tenantErr?.message ?? 'unknown'}`);
      }

      // Insert tenant_configs
      const { data: tenantConfig, error: configErr } = await supabase
        .from('tenant_configs')
        .insert({
          tenant_id: tenant.id,
          business_name,
          ...configFields,
        })
        .select('id')
        .single();

      if (configErr || !tenantConfig) {
        // Best-effort rollback
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw new Error(`Failed to create tenant config: ${configErr?.message ?? 'unknown'}`);
      }

      logger.info({ tenantId: tenant.id, email, ip }, 'tenant_created');

      res.status(201).json({
        tenant_id: tenant.id,
        config_id: tenantConfig.id,
        message: 'Tenant created successfully',
      });
    } catch (err: unknown) {
      console.error('SETUP_ERROR_DETAIL:', err);
      logger.error(
        { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, raw: JSON.stringify(err) },
        'setup_error',
      );
      next(err);
    }
  },
);
