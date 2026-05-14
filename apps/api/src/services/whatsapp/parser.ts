export type ParsedMessage =
  | {
      type: 'text';
      waMessageId: string;
      from: string;
      text: string;
      phoneNumberId: string;
      timestamp: number;
    }
  | {
      type: 'audio';
      waMessageId: string;
      from: string;
      audioId: string;
      phoneNumberId: string;
      timestamp: number;
    }
  | { type: 'unsupported'; original: unknown };

const UNSUPPORTED_TYPES = new Set([
  'image',
  'video',
  'document',
  'sticker',
  'location',
  'contacts',
  'reaction',
  'unsupported',
  'deleted',
]);

export function parseWebhookBody(body: unknown): ParsedMessage[] {
  try {
    const payload = body as Record<string, unknown>;
    if (payload?.object !== 'whatsapp_business_account') return [];

    const entries = (payload.entry as unknown[]) ?? [];
    const results: ParsedMessage[] = [];

    for (const entry of entries) {
      const changes = ((entry as Record<string, unknown>).changes as unknown[]) ?? [];
      for (const change of changes) {
        const value = (change as Record<string, unknown>).value as Record<string, unknown>;
        if (!value) continue;

        const phoneNumberId = (value.metadata as Record<string, unknown>)
          ?.phone_number_id as string;
        const messages = (value.messages as unknown[]) ?? [];

        for (const msg of messages) {
          results.push(parseMessage(msg, phoneNumberId));
        }
      }
    }

    return results;
  } catch {
    return [{ type: 'unsupported', original: body }];
  }
}

function parseMessage(msg: unknown, phoneNumberId: string): ParsedMessage {
  try {
    const m = msg as Record<string, unknown>;
    const msgType = m.type as string;
    const waMessageId = m.id as string;
    const from = m.from as string;
    const timestamp = Number(m.timestamp);

    if (msgType === 'text') {
      const text = ((m.text as Record<string, unknown>)?.body as string) ?? '';
      return { type: 'text', waMessageId, from, text, phoneNumberId, timestamp };
    }

    if (msgType === 'audio') {
      const audioId = ((m.audio as Record<string, unknown>)?.id as string) ?? '';
      return { type: 'audio', waMessageId, from, audioId, phoneNumberId, timestamp };
    }

    if (UNSUPPORTED_TYPES.has(msgType) || !msgType) {
      return { type: 'unsupported', original: msg };
    }

    return { type: 'unsupported', original: msg };
  } catch {
    return { type: 'unsupported', original: msg };
  }
}
