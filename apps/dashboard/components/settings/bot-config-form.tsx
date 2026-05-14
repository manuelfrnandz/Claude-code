'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { tenantApi, type TenantConfig } from '@/lib/api';

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? '';

// ─── Internal form shape ─────────────────────────────────────────────────────
// All fields are strings/booleans/arrays — JSON fields stored as raw strings.

interface ConfigForm {
  bot_name: string;
  business_name: string;
  business_description: string;
  personality: string;
  language: string;
  wa_phone_number_id: string;
  wa_access_token: string;
  welcome_message: string;
  phone_human: string;
  catalog_data: string;
  faq_data: string;
  conversation_mode: 'ai' | 'human' | 'hybrid';
  enabled_intents: string[];
  escalation_triggers: string;
  system_prompt: string;
  notification_email: string;
  location: string;
  orders_enabled: boolean;
  appointments_enabled: boolean;
}

const EMPTY_FORM: ConfigForm = {
  bot_name: '',
  business_name: '',
  business_description: '',
  personality: 'amigable',
  language: 'español',
  wa_phone_number_id: '',
  wa_access_token: '',
  welcome_message: '',
  phone_human: '',
  catalog_data: '',
  faq_data: '',
  conversation_mode: 'ai',
  enabled_intents: [],
  escalation_triggers: '',
  system_prompt: '',
  notification_email: '',
  location: '',
  orders_enabled: false,
  appointments_enabled: false,
};

const INTENT_OPTIONS = ['ventas', 'soporte', 'citas', 'información', 'otro'];

// ─── Config ↔ form converters ─────────────────────────────────────────────────

function configToForm(c: TenantConfig): ConfigForm {
  return {
    bot_name: c.bot_name ?? '',
    business_name: c.business_name ?? '',
    business_description: c.business_description ?? '',
    personality: c.personality ?? 'amigable',
    language: c.language ?? 'español',
    wa_phone_number_id: c.wa_phone_number_id ?? '',
    wa_access_token: c.wa_access_token ?? '',
    welcome_message: c.welcome_message ?? '',
    phone_human: c.phone_human ?? '',
    catalog_data: c.catalog_data ? JSON.stringify(c.catalog_data, null, 2) : '',
    faq_data: c.faq_data ? JSON.stringify(c.faq_data, null, 2) : '',
    conversation_mode: c.conversation_mode ?? 'ai',
    enabled_intents: c.enabled_intents ?? [],
    escalation_triggers: (c.escalation_triggers ?? []).join(', '),
    system_prompt: c.system_prompt ?? '',
    notification_email: c.notification_email ?? '',
    location: c.location ?? '',
    orders_enabled: c.orders_enabled ?? false,
    appointments_enabled: c.appointments_enabled ?? false,
  };
}

function formToPayload(f: ConfigForm): Partial<TenantConfig> {
  return {
    bot_name: f.bot_name,
    business_name: f.business_name,
    business_description: f.business_description || null,
    personality: f.personality,
    language: f.language,
    wa_phone_number_id: f.wa_phone_number_id || null,
    wa_access_token: f.wa_access_token || null,
    welcome_message: f.welcome_message || null,
    phone_human: f.phone_human || null,
    catalog_data: f.catalog_data.trim() ? (JSON.parse(f.catalog_data) as unknown) : null,
    faq_data: f.faq_data.trim() ? (JSON.parse(f.faq_data) as unknown) : null,
    conversation_mode: f.conversation_mode,
    enabled_intents: f.enabled_intents,
    escalation_triggers: f.escalation_triggers
      ? f.escalation_triggers.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    system_prompt: f.system_prompt || null,
    notification_email: f.notification_email || null,
    location: f.location || null,
    orders_enabled: f.orders_enabled,
    appointments_enabled: f.appointments_enabled,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pt-4 pb-5 border-t border-gray-100 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {helper && <p className="mt-1 text-xs text-gray-400">{helper}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  onBlur,
  rows = 3,
  placeholder,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={rows}
      placeholder={placeholder}
      className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y ${
        mono ? 'font-mono' : ''
      }`}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-9 bg-gray-100 rounded" />
            <div className="h-9 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BotConfigForm({
  onDirtyChange,
}: {
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jsonErrors, setJsonErrors] = useState<{ catalog_data?: string; faq_data?: string }>({});
  const [showToken, setShowToken] = useState(false);
  const [openSections, setOpenSections] = useState([true, false, false, false, false]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Track the last-saved/loaded form for dirty comparison
  const savedForm = useRef<ConfigForm>(EMPTY_FORM);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm.current);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Load config on mount
  useEffect(() => {
    if (!TENANT_ID) {
      setIsLoading(false);
      return;
    }
    tenantApi
      .getConfig(TENANT_ID)
      .then((config) => {
        const f = configToForm(config);
        setForm(f);
        savedForm.current = f;
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Error al cargar la configuración.';
        setLoadError(msg);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function set<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSection(i: number) {
    setOpenSections((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function validateJson(field: 'catalog_data' | 'faq_data') {
    const value = form[field].trim();
    if (!value) {
      setJsonErrors((e) => ({ ...e, [field]: undefined }));
      return;
    }
    try {
      JSON.parse(value);
      setJsonErrors((e) => ({ ...e, [field]: undefined }));
    } catch {
      setJsonErrors((e) => ({ ...e, [field]: 'JSON inválido — revisa la sintaxis' }));
    }
  }

  function toggleIntent(intent: string) {
    set(
      'enabled_intents',
      form.enabled_intents.includes(intent)
        ? form.enabled_intents.filter((i) => i !== intent)
        : [...form.enabled_intents, intent],
    );
  }

  const handleSave = useCallback(async () => {
    // Block save if JSON is invalid
    if (jsonErrors.catalog_data || jsonErrors.faq_data) {
      setSaveState('error');
      setSaveError('Corrige los errores de JSON antes de guardar.');
      return;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      const payload = formToPayload(form);
      await tenantApi.updateConfig(TENANT_ID, payload);
      savedForm.current = form;
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al guardar. Intenta de nuevo.';
      setSaveError(msg);
      setSaveState('error');
    }
  }, [form, jsonErrors]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <Skeleton />;

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* ── Section 1: Identidad ── */}
      <Section
        title="1. Identidad del bot"
        isOpen={openSections[0]!}
        onToggle={() => toggleSection(0)}
      >
        <Field label="Nombre del bot">
          <TextInput
            value={form.bot_name}
            onChange={(v) => set('bot_name', v)}
            placeholder="Asistente"
          />
        </Field>
        <Field label="Nombre del negocio *">
          <TextInput
            value={form.business_name}
            onChange={(v) => set('business_name', v)}
            placeholder="Mi Negocio"
          />
        </Field>
        <Field label="Descripción del negocio">
          <Textarea
            value={form.business_description}
            onChange={(v) => set('business_description', v)}
            rows={3}
            placeholder="Somos una empresa dedicada a..."
          />
        </Field>
        <Field label="Personalidad">
          <SelectInput
            value={form.personality}
            onChange={(v) => set('personality', v)}
            options={[
              { value: 'amigable', label: 'Amigable' },
              { value: 'profesional', label: 'Profesional' },
              { value: 'formal', label: 'Formal' },
              { value: 'casual', label: 'Casual' },
              { value: 'entusiasta', label: 'Entusiasta' },
            ]}
          />
        </Field>
        <Field label="Idioma">
          <SelectInput
            value={form.language}
            onChange={(v) => set('language', v)}
            options={[
              { value: 'español', label: 'Español' },
              { value: 'english', label: 'English' },
              { value: 'português', label: 'Português' },
              { value: 'français', label: 'Français' },
            ]}
          />
        </Field>
      </Section>

      {/* ── Section 2: WhatsApp ── */}
      <Section
        title="2. Configuración de WhatsApp"
        isOpen={openSections[1]!}
        onToggle={() => toggleSection(1)}
      >
        <Field label="Phone Number ID">
          <TextInput
            value={form.wa_phone_number_id}
            onChange={(v) => set('wa_phone_number_id', v)}
            placeholder="ID numérico de Meta"
          />
        </Field>
        <Field label="Access Token">
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={form.wa_access_token}
              onChange={(e) => set('wa_access_token', e.target.value)}
              placeholder="EAAxxxx..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-20 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
            >
              {showToken ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </Field>
        <Field label="Mensaje de bienvenida">
          <Textarea
            value={form.welcome_message}
            onChange={(v) => set('welcome_message', v)}
            rows={2}
            placeholder="¡Hola! Soy tu asistente virtual. ¿En qué te puedo ayudar?"
          />
        </Field>
        <Field label="Teléfono de atención humana">
          <TextInput
            value={form.phone_human}
            onChange={(v) => set('phone_human', v)}
            placeholder="+521234567890"
            type="tel"
          />
        </Field>
      </Section>

      {/* ── Section 3: Contenido JSON ── */}
      <Section
        title="3. Contenido (catálogo y FAQ)"
        isOpen={openSections[2]!}
        onToggle={() => toggleSection(2)}
      >
        <Field label="Catálogo de productos" helper='Array JSON: [{"name":"...","price":100}]'>
          <Textarea
            value={form.catalog_data}
            onChange={(v) => set('catalog_data', v)}
            onBlur={() => validateJson('catalog_data')}
            rows={6}
            placeholder='[{"name": "Producto", "price": 100, "description": "Descripción"}]'
            mono
          />
          {jsonErrors.catalog_data && (
            <p className="mt-1 text-xs text-red-600">{jsonErrors.catalog_data}</p>
          )}
        </Field>
        <Field label="Preguntas frecuentes" helper='Array JSON: [{"q":"¿...?","a":"..."}]'>
          <Textarea
            value={form.faq_data}
            onChange={(v) => set('faq_data', v)}
            onBlur={() => validateJson('faq_data')}
            rows={6}
            placeholder='[{"q": "¿Cuánto cuesta?", "a": "Desde $100"}]'
            mono
          />
          {jsonErrors.faq_data && (
            <p className="mt-1 text-xs text-red-600">{jsonErrors.faq_data}</p>
          )}
        </Field>
      </Section>

      {/* ── Section 4: Comportamiento ── */}
      <Section
        title="4. Comportamiento"
        isOpen={openSections[3]!}
        onToggle={() => toggleSection(3)}
      >
        <Field label="Modo de conversación">
          <SelectInput
            value={form.conversation_mode}
            onChange={(v) => set('conversation_mode', v as 'ai' | 'human' | 'hybrid')}
            options={[
              { value: 'ai', label: 'Solo bot — el bot responde automáticamente' },
              { value: 'human', label: 'Solo humano — el bot no responde' },
              { value: 'hybrid', label: 'Supervisado — bot responde + agente supervisa' },
            ]}
          />
        </Field>
        <Field label="Intents habilitados">
          <div className="flex flex-wrap gap-3 mt-1">
            {INTENT_OPTIONS.map((intent) => (
              <label key={intent} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled_intents.includes(intent)}
                  onChange={() => toggleIntent(intent)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 capitalize">{intent}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field
          label="Triggers de escalación"
          helper="Palabras o frases que activan el handoff a humano (separadas por coma)"
        >
          <Textarea
            value={form.escalation_triggers}
            onChange={(v) => set('escalation_triggers', v)}
            rows={2}
            placeholder="cancelar, hablar con humano, urgente, quiero hablar con alguien"
          />
        </Field>
        <Field
          label="System prompt personalizado"
          helper="Si se define, reemplaza toda la configuración de identidad del bot"
        >
          <Textarea
            value={form.system_prompt}
            onChange={(v) => set('system_prompt', v)}
            rows={8}
            placeholder="Eres un asistente de [negocio]. Tu objetivo es..."
            mono
          />
        </Field>
      </Section>

      {/* ── Section 5: Notificaciones y ubicación ── */}
      <Section
        title="5. Notificaciones y ubicación"
        isOpen={openSections[4]!}
        onToggle={() => toggleSection(4)}
      >
        <Field label="Email de notificaciones">
          <TextInput
            value={form.notification_email}
            onChange={(v) => set('notification_email', v)}
            placeholder="alertas@minegocio.com"
            type="email"
          />
        </Field>
        <Field label="Ubicación">
          <TextInput
            value={form.location}
            onChange={(v) => set('location', v)}
            placeholder="Ciudad de México, CDMX"
          />
        </Field>
        <div className="flex flex-col gap-3 pt-1">
          <Switch
            checked={form.orders_enabled}
            onChange={(v) => set('orders_enabled', v)}
            label="Habilitar módulo de órdenes"
          />
          <Switch
            checked={form.appointments_enabled}
            onChange={(v) => set('appointments_enabled', v)}
            label="Habilitar módulo de citas"
          />
        </div>
      </Section>

      {/* ── Sticky save bar ── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-1 py-4 mt-2">
        {saveState === 'error' && saveError && (
          <p className="text-xs text-red-600 mb-2">{saveError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving' || !isDirty}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saveState === 'saving' ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Guardando…
              </>
            ) : saveState === 'saved' ? (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Guardado
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
          {isDirty && saveState !== 'saving' && saveState !== 'saved' && (
            <span className="text-xs text-amber-600 font-medium">
              Cambios sin guardar
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
