import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Inject tenant ID — prefers localStorage (runtime), falls back to env var (build-time)
api.interceptors.request.use((config) => {
  const tenantId =
    (typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null) ??
    process.env.NEXT_PUBLIC_TENANT_ID ??
    '';
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (page = 1): Promise<PaginatedResponse<Lead>> =>
    api.get('/leads', { params: { page, limit: 20 } }).then((r) => r.data),
  update: (id: string, data: Partial<Lead>): Promise<Lead> =>
    api.patch(`/leads/${id}`, data).then((r) => r.data),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: { status?: string; page?: number }) =>
    api.get('/orders', { params }).then((r) => r.data),
  summary: () => api.get('/orders/summary').then((r) => r.data),
  get: (id: string) => api.get(`/orders/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
};

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (): Promise<PaginatedResponse<ConversationItem>> =>
    api.get('/conversations').then((r) => r.data),
  get: (id: string): Promise<ConversationItem> =>
    api.get(`/conversations/${id}`).then((r) => r.data),
  messages: (id: string): Promise<{ data: MessageItem[]; conversationId: string }> =>
    api.get(`/conversations/${id}/messages`).then((r) => r.data),
  setMode: (
    id: string,
    mode: 'ai' | 'human' | 'hybrid',
  ): Promise<{ conversationId: string; mode: string }> =>
    api.patch(`/conversations/${id}/mode`, { mode }).then((r) => r.data),
};

// ─── Tenant Config ────────────────────────────────────────────────────────────
export const tenantApi = {
  getConfig: (tenantId: string): Promise<TenantConfig> =>
    api.get(`/tenants/${tenantId}/config`).then((r) => r.data),
  updateConfig: (tenantId: string, data: Partial<TenantConfig>): Promise<TenantConfig> =>
    api.put(`/tenants/${tenantId}/config`, data).then((r) => r.data),
};

// ─── Stats ────────────────────────────────────────────────────────────────────
export const statsApi = {
  get: () => api.get('/stats').then((r) => r.data),
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export interface SetupPayload {
  business_name: string;
  email: string;
  bot_name?: string;
  wa_phone_number_id?: string;
  wa_access_token?: string;
  personality?: string;
  language?: string;
  welcome_message?: string;
  phone_human?: string;
}

export interface SetupResult {
  tenant_id: string;
  config_id: string;
  message: string;
}

export async function setupTenant(
  payload: SetupPayload,
  adminSecret: string,
): Promise<SetupResult> {
  const res = await api.post('/setup', payload, {
    headers: { Authorization: `Bearer ${adminSecret}` },
  });
  return res.data;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit?: number;
}

export interface ConversationItem {
  id: string;
  tenant_id: string;
  phone: string;
  status: 'active' | 'closed' | 'handoff';
  mode: 'ai' | 'human' | 'hybrid';
  primary_intent: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  message_type: string;
  created_at: string;
}

export interface Lead {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  stage: 'nuevo' | 'calificado' | 'convertido' | 'perdido';
  intent_detected: string | null;
  first_contact_at: string;
  last_contact_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  items: OrderItem[];
  total: number;
  payment_method: string | null;
  delivery_type: string;
  created_at: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

export interface TenantConfig {
  id?: string;
  tenant_id?: string;
  bot_name: string;
  business_name: string;
  business_description: string | null;
  personality: string;
  language: string;
  wa_phone_number_id: string | null;
  wa_access_token: string | null;
  system_prompt: string | null;
  catalog_data: unknown;
  faq_data: unknown;
  schedule: unknown;
  location: string | null;
  phone_human: string | null;
  notification_email: string | null;
  welcome_message: string | null;
  escalation_triggers: string[];
  conversation_mode: 'ai' | 'human' | 'hybrid';
  enabled_intents: string[];
  orders_enabled: boolean;
  appointments_enabled: boolean;
  updated_at?: string;
}
