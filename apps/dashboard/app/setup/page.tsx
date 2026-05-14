'use client';

import { useState } from 'react';
import { setupTenant, type SetupPayload, type SetupResult } from '@/lib/api';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: SetupResult }
  | { status: 'error'; message: string };

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';

export default function SetupPage() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [showToken, setShowToken] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: 'loading' });

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload: SetupPayload = {
      business_name: data.get('business_name') as string,
      email: data.get('email') as string,
      bot_name: (data.get('bot_name') as string) || undefined,
      wa_phone_number_id: (data.get('wa_phone_number_id') as string) || undefined,
      wa_access_token: (data.get('wa_access_token') as string) || undefined,
      personality: (data.get('personality') as string) || undefined,
      language: (data.get('language') as string) || undefined,
      welcome_message: (data.get('welcome_message') as string) || undefined,
      phone_human: (data.get('phone_human') as string) || undefined,
    };

    try {
      const result = await setupTenant(payload, ADMIN_SECRET);
      setState({ status: 'success', result });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setState({ status: 'error', message: 'Este email ya tiene una cuenta registrada.' });
      } else if (status === 403) {
        setState({ status: 'error', message: 'No autorizado — verifica que NEXT_PUBLIC_ADMIN_SECRET sea correcto.' });
      } else {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Error inesperado. Intenta de nuevo.';
        setState({ status: 'error', message: msg });
      }
    }
  }

  if (state.status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 text-center mb-1">¡Listo!</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Tu cuenta ha sido creada exitosamente.</p>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Tenant ID</p>
              <code className="text-sm font-mono text-gray-900 break-all">{state.result.tenant_id}</code>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Config ID</p>
              <code className="text-sm font-mono text-gray-900 break-all">{state.result.config_id}</code>
            </div>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mt-4">
            Copia tu <strong>Tenant ID</strong> y agrégalo como{' '}
            <code>NEXT_PUBLIC_TENANT_ID</code> en las variables de entorno del dashboard.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = state.status === 'loading';

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Configurar tu cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">Onboarding inicial — crea tu tenant y configura el bot</p>
        </div>

        {state.status === 'error' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          {/* Required */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Información básica *</h2>

            <Field label="Nombre del negocio *" name="business_name" required placeholder="Mi Restaurante" />
            <Field label="Email *" name="email" type="email" required placeholder="owner@ejemplo.com" />
          </div>

          {/* Bot config */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Configuración del bot</h2>

            <Field label="Nombre del bot" name="bot_name" placeholder="Asistente" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personalidad</label>
              <select
                name="personality"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="amigable">Amigable</option>
                <option value="profesional">Profesional</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
              <select
                name="language"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="español">Español</option>
                <option value="english">English</option>
                <option value="português">Português</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de bienvenida</label>
              <textarea
                name="welcome_message"
                rows={2}
                placeholder="¡Hola! Soy tu asistente virtual. ¿En qué te puedo ayudar?"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">WhatsApp</h2>

            <Field label="Phone Number ID" name="wa_phone_number_id" placeholder="ID de Meta (numérico)" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <div className="relative">
                <input
                  name="wa_access_token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="EAAxxxx..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-16 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  {showToken ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <Field label="Teléfono humano (handoff)" name="phone_human" placeholder="+521234567890" />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creando cuenta…
              </>
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
  );
}
