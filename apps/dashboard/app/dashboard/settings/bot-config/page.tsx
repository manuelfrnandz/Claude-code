'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BotConfigForm } from '@/components/settings/bot-config-form';

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? '';

export default function BotConfigPage() {
  const [isDirty, setIsDirty] = useState(false);

  if (!TENANT_ID) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración del Bot</h1>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            NEXT_PUBLIC_TENANT_ID no está configurado
          </p>
          <p className="text-sm text-amber-700 mb-3">
            Necesitas crear una cuenta y configurar el Tenant ID antes de poder editar la configuración del bot.
          </p>
          <Link
            href="/setup"
            className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            Ir a /setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Configuración del Bot</h1>
            {isDirty && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Sin guardar
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Personaliza cómo responde tu agente de WhatsApp
          </p>
        </div>
      </div>

      <BotConfigForm onDirtyChange={setIsDirty} />
    </div>
  );
}
