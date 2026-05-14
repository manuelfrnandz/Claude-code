import { BotConfigForm } from "@/components/settings/bot-config-form";

export default function BotConfigPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración del Bot</h1>
        <p className="text-gray-500 text-sm mt-1">
          Personaliza cómo responde tu agente de WhatsApp
        </p>
      </div>
      <BotConfigForm />
    </div>
  );
}
