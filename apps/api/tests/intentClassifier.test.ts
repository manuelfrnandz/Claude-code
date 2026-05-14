// ─── Mock OpenAI before any import ───────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock('../src/services/ai/openaiClient', () => ({
  openai: {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  },
}));

import { classifyIntent } from '../src/services/ai/intentClassifier';

const ALL_INTENTS = ['ventas', 'soporte', 'citas'];

function makeCompletion(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

describe('classifyIntent', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  // ─── Keyword fast-path (no LLM) ──────────────────────────────────────────────

  it('detects ventas via keyword without calling OpenAI', async () => {
    const result = await classifyIntent('¿Cuánto cuesta el producto?', ALL_INTENTS);
    expect(result.intent).toBe('ventas');
    expect(result.confidence).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('detects soporte via keyword without calling OpenAI', async () => {
    const result = await classifyIntent('Tengo un error en mi aplicación', ALL_INTENTS);
    expect(result.intent).toBe('soporte');
    expect(result.confidence).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('detects citas via keyword without calling OpenAI', async () => {
    const result = await classifyIntent('Quiero agendar una cita', ALL_INTENTS);
    expect(result.intent).toBe('citas');
    expect(result.confidence).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('detects queja via keyword when queja is in enabledIntents', async () => {
    const result = await classifyIntent('Estoy muy molesto, es pésimo servicio', ['queja']);
    expect(result.intent).toBe('queja');
    expect(result.confidence).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('detects handoff via keyword even when not in enabledIntents', async () => {
    const result = await classifyIntent('Quiero hablar con un agente', []);
    expect(result.intent).toBe('handoff');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not match disabled intent via keyword (calls LLM instead)', async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"intent":"otro","confidence":0.4}'));
    // 'ventas' keywords should be ignored when ventas is not enabled
    const result = await classifyIntent('quiero comprar', ['soporte']);
    // handoff/queja always work, but ventas is disabled → goes to LLM
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe('otro');
  });

  // ─── LLM path ────────────────────────────────────────────────────────────────

  it('calls OpenAI and returns classified intent for non-keyword text', async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"intent":"ventas","confidence":0.9}'));

    const result = await classifyIntent('Me interesa lo que ofrecen', ALL_INTENTS);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe('ventas');
    expect(result.confidence).toBe(0.9);
  });

  it('normalizes intent not in allowed list to "otro"', async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"intent":"unknown_intent","confidence":0.8}'));

    const result = await classifyIntent('texto genérico', ALL_INTENTS);
    expect(result.intent).toBe('otro');
  });

  it('uses 0.5 confidence when OpenAI returns non-number confidence', async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"intent":"soporte","confidence":"high"}'));

    const result = await classifyIntent('algo raro', ALL_INTENTS);
    expect(result.intent).toBe('soporte');
    expect(result.confidence).toBe(0.5);
  });

  it('returns fallback when OpenAI throws an error', async () => {
    mockCreate.mockRejectedValue(new Error('OpenAI service unavailable'));

    const result = await classifyIntent('cualquier texto', ALL_INTENTS);
    expect(result.intent).toBe('otro');
    expect(result.confidence).toBe(0);
  });

  it('returns fallback when OpenAI returns invalid JSON', async () => {
    mockCreate.mockResolvedValue(makeCompletion('not-valid-json'));

    const result = await classifyIntent('cualquier texto', ALL_INTENTS);
    expect(result.intent).toBe('otro');
    expect(result.confidence).toBe(0);
  });

  it('returns fallback when OpenAI returns empty content', async () => {
    mockCreate.mockResolvedValue(makeCompletion(''));

    const result = await classifyIntent('cualquier texto', ALL_INTENTS);
    expect(result.intent).toBe('otro');
    expect(result.confidence).toBe(0);
  });

  it('handles empty enabledIntents array without throwing', async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"intent":"otro","confidence":0.3}'));

    await expect(classifyIntent('hola', [])).resolves.not.toThrow();
  });

  it('always includes handoff and queja in the LLM prompt intents', async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"intent":"handoff","confidence":0.95}'));

    const result = await classifyIntent('necesito ayuda especializada', ['ventas']);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockCreate.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content as string;
    expect(systemContent).toContain('handoff');
    expect(systemContent).toContain('queja');
    expect(systemContent).toContain('otro');
  });
});
