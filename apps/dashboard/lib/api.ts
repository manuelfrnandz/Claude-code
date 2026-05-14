import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Inject tenant ID from localStorage/session
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const tenantId = localStorage.getItem("tenant_id");
    if (tenantId) {
      config.headers["X-Tenant-ID"] = tenantId;
    }
  }
  return config;
});

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (params?: { stage?: string; page?: number; page_size?: number }) =>
    api.get("/leads", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/leads/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<Lead>) =>
    api.patch(`/leads/${id}`, data).then((r) => r.data),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: { status?: string; page?: number }) =>
    api.get("/orders", { params }).then((r) => r.data),
  summary: () => api.get("/orders/summary").then((r) => r.data),
  get: (id: string) => api.get(`/orders/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
};

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (params?: { status?: string }) =>
    api.get("/conversations", { params }).then((r) => r.data),
  messages: (id: string) =>
    api.get(`/conversations/${id}/messages`).then((r) => r.data),
};

// ─── Tenant Config ────────────────────────────────────────────────────────────
export const tenantApi = {
  getConfig: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/config`).then((r) => r.data),
  updateConfig: (tenantId: string, data: Partial<TenantConfig>) =>
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
export interface Lead {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  stage: string;
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
  bot_name: string;
  business_name: string;
  business_description: string;
  personality: string;
  language: string;
  location: string;
  phone_human: string;
  schedule: Record<string, { open: string; close: string; closed?: boolean }>;
  catalog_data: CatalogItem[];
  faq_data: FAQ[];
  enabled_flows: string[];
  orders_enabled: boolean;
  appointments_enabled: boolean;
  escalation_triggers: string[];
  custom_instructions: string;
  welcome_message: string;
}

export interface CatalogItem {
  name: string;
  price: number;
  description: string;
  category?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}
