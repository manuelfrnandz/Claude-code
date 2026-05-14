import { openai } from './openaiClient';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import type { Intent, IntentResult } from '../../types';

const FALLBACK: IntentResult = { intent: 'otro', confidence: 0 };

// ─── Keyword fast-path (no LLM cost) ─────────────────────────────────────────

const KEYWORD_MAP: Record<Intent, string[]> = {
  ventas: ['precio', 'costo', 'cuánto', 'cuanto', 'comprar', 'pedir', 'pedido', 'orden', 'producto', 'catálogo', 'catalogo'],
  soporte: ['problema', 'error', 'falla', 'ayuda', 'no funciona', 'roto', 'reclamo', 'queja'],
  citas: ['cita', 'reservar', 'reserva', 'agendar', 'appointment', 'horario', 'disponibilidad'],
  queja: ['queja', 'molesto', 'enojado', 'insatisfecho', 'terrible', 'pésimo', 'pesimo'],
  handoff: ['hablar con humano', 'hablar con persona', 'agente', 'representante'],
  otro: [],
};

function keywordFastPath(text: string, enabledIntents: string[]): Intent | null {
  const lower = text.toLowerCase();
  for (const [intent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (intent === 'otro') continue;
    if (!enabledIntents.includes(intent) && intent !== 'handoff') continue;
    if (keywords.some((kw) => lower.includes(kw))) return intent as Intent;
  }
  return null;
}

// ─── GPT-4o-mini fallback ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un clasificador de intenciones para un chatbot de WhatsApp.
Clasifica el mensaje del usuario en UNA de estas intenciones y responde SOLO con JSON válido.
No agregues explicaciones ni markdown.`;

export async function classifyIntent(
  text: string,
  enabledIntents: string[],
): Promise<IntentResult> {
  // Fast-path: avoid LLM call for obvious keywords
  const keyword = keywordFastPath(text, enabledIntents);
  if (keyword) return { intent: keyword, confidence: 1 };

  const allowed = [...new Set([...enabledIntents, 'handoff', 'queja', 'otro'])];

  try {
    const completion = await openai.chat.completions.create({
      model: config.OPENAI_INTENT_MODEL,
      temperature: 0,
      max_tokens: 60,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\nIntenciones válidas: ${allowed.join(', ')}.\nFormato de respuesta: {"intent":"<valor>","confidence":<0-1>}`,
        },
        { role: 'user', content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { intent: string; confidence: number };
    const intent = allowed.includes(parsed.intent) ? (parsed.intent as Intent) : 'otro';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    return { intent, confidence };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'intent_classifier_error');
    return FALLBACK;
  }
}
