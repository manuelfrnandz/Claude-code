import { openai } from './openaiClient';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const FALLBACK_RESPONSE =
  'Estoy tardando más de lo esperado. Por favor intenta en un momento 🙏';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateResponse(
  messages: ChatMessage[],
  systemPrompt: string,
  tenantId: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.OPENAI_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: config.OPENAI_CHAT_MODEL,
        max_tokens: config.OPENAI_MAX_TOKENS,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      },
      { signal: controller.signal },
    );

    return completion.choices[0]?.message?.content?.trim() ?? FALLBACK_RESPONSE;
  } catch (err) {
    const error = err as Error;
    if (error.name === 'AbortError' || ('status' in error && (err as { status: number }).status === 408)) {
      logger.warn({ tenantId }, 'openai_timeout');
      return FALLBACK_RESPONSE;
    }
    if ('status' in error && (err as { status: number }).status === 429) {
      logger.warn({ tenantId }, 'openai_rate_limit');
      return 'Estoy procesando muchas solicitudes. Intenta en un momento 🙏';
    }
    // Any other error: let BullMQ retry
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
