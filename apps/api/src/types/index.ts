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

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface TenantConfig {
  id: string;
  tenantId: string;
  waPhoneNumberId: string;
  waAccessToken: string;
  botName: string;
  businessName: string;
  businessDescription: string | null;
  personality: string;
  language: string;
  systemPrompt: string | null; // if set, used verbatim as system prompt
  catalogData: unknown | null; // JSONB array
  faqData: unknown | null;     // JSONB array
  schedule: unknown | null;    // JSONB
  location: string | null;
  phoneHuman: string | null;
  notificationEmail: string | null;
  welcomeMessage: string | null;
  escalationTriggers: string[];
  conversationMode: 'ai' | 'human' | 'hybrid';
  enabledIntents: string[];
  ordersEnabled: boolean;
  appointmentsEnabled: boolean;
}

export type Intent = 'ventas' | 'soporte' | 'citas' | 'queja' | 'handoff' | 'otro';

export interface IntentResult {
  intent: Intent;
  confidence: number;
}
