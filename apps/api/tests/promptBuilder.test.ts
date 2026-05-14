import { buildSystemPrompt } from '../src/services/ai/promptBuilder';
import { buildTenantConfig } from './helpers/factories';

describe('buildSystemPrompt', () => {
  it('returns systemPrompt verbatim when set', () => {
    const config = buildTenantConfig({ systemPrompt: 'Custom prompt override.' });
    const result = buildSystemPrompt(config);
    expect(result).toBe('Custom prompt override.');
  });

  it('includes bot name and business name in identity section', () => {
    const config = buildTenantConfig({ botName: 'Robi', businessName: 'Mi Restaurante' });
    const result = buildSystemPrompt(config);
    expect(result).toContain('Robi');
    expect(result).toContain('Mi Restaurante');
  });

  it('includes personality and language', () => {
    const config = buildTenantConfig({ personality: 'formal', language: 'inglés' });
    const result = buildSystemPrompt(config);
    expect(result).toContain('formal');
    expect(result).toContain('inglés');
  });

  it('includes business description when provided', () => {
    const config = buildTenantConfig({ businessDescription: 'Vendemos tacos artesanales.' });
    const result = buildSystemPrompt(config);
    expect(result).toContain('Vendemos tacos artesanales.');
  });

  it('omits business description when null', () => {
    const config = buildTenantConfig({ businessDescription: null });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('Descripción:');
  });

  it('includes location when provided', () => {
    const config = buildTenantConfig({ location: 'Av. Insurgentes 123, CDMX' });
    const result = buildSystemPrompt(config);
    expect(result).toContain('Av. Insurgentes 123, CDMX');
  });

  it('omits location when null', () => {
    const config = buildTenantConfig({ location: null });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('Ubicación:');
  });

  it('includes schedule when provided', () => {
    const schedule = { lunes: '9-18', sabado: '9-14' };
    const config = buildTenantConfig({ schedule });
    const result = buildSystemPrompt(config);
    expect(result).toContain('Horario:');
    expect(result).toContain('lunes');
  });

  it('includes catalog items with name, price, and description', () => {
    const catalogData = [
      { name: 'Taco de Bistec', price: 25, description: 'Con cilantro y cebolla' },
      { name: 'Agua de Horchata', price: 15 },
    ];
    const config = buildTenantConfig({ catalogData });
    const result = buildSystemPrompt(config);
    expect(result).toContain('[CATÁLOGO]');
    expect(result).toContain('Taco de Bistec');
    expect(result).toContain('$25');
    expect(result).toContain('Con cilantro y cebolla');
    expect(result).toContain('Agua de Horchata');
    expect(result).toContain('$15');
  });

  it('includes catalog items without price gracefully', () => {
    const catalogData = [{ name: 'Servicio Premium' }];
    const config = buildTenantConfig({ catalogData });
    const result = buildSystemPrompt(config);
    expect(result).toContain('Servicio Premium');
    expect(result).not.toContain('undefined');
  });

  it('omits catalog section when catalogData is null', () => {
    const config = buildTenantConfig({ catalogData: null });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('[CATÁLOGO]');
  });

  it('omits catalog section when catalogData is empty array', () => {
    const config = buildTenantConfig({ catalogData: [] });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('[CATÁLOGO]');
  });

  it('includes FAQ section with questions and answers', () => {
    const faqData = [
      { question: '¿Hacen envíos?', answer: 'Sí, a toda la ciudad.' },
      { question: '¿Cuál es el mínimo de pedido?', answer: '$100 pesos.' },
    ];
    const config = buildTenantConfig({ faqData });
    const result = buildSystemPrompt(config);
    expect(result).toContain('[PREGUNTAS FRECUENTES]');
    expect(result).toContain('¿Hacen envíos?');
    expect(result).toContain('Sí, a toda la ciudad.');
    expect(result).toContain('¿Cuál es el mínimo de pedido?');
  });

  it('omits FAQ section when faqData is null', () => {
    const config = buildTenantConfig({ faqData: null });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('[PREGUNTAS FRECUENTES]');
  });

  it('includes human phone in rules when provided', () => {
    const config = buildTenantConfig({ phoneHuman: '+521234567890' });
    const result = buildSystemPrompt(config);
    expect(result).toContain('+521234567890');
  });

  it('omits human phone rule when phoneHuman is null', () => {
    const config = buildTenantConfig({ phoneHuman: null });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('contactar a:');
  });

  it('includes escalation triggers when provided', () => {
    const config = buildTenantConfig({ escalationTriggers: ['cancelar', 'reembolso', 'fraude'] });
    const result = buildSystemPrompt(config);
    expect(result).toContain('cancelar');
    expect(result).toContain('reembolso');
    expect(result).toContain('fraude');
  });

  it('omits escalation rule when triggers array is empty', () => {
    const config = buildTenantConfig({ escalationTriggers: [] });
    const result = buildSystemPrompt(config);
    expect(result).not.toContain('Escala a un humano');
  });

  it('always includes the [REGLAS] section with base rules', () => {
    const config = buildTenantConfig();
    const result = buildSystemPrompt(config);
    expect(result).toContain('[REGLAS]');
    expect(result).toContain('Responde de forma concisa y útil.');
    expect(result).toContain('Si no sabes algo, dilo con honestidad.');
    expect(result).toContain('No inventes precios ni información.');
  });

  it('builds a minimal prompt with only required fields', () => {
    const config = buildTenantConfig({
      botName: 'Bot',
      businessName: 'Empresa',
      businessDescription: null,
      systemPrompt: null,
      catalogData: null,
      faqData: null,
      schedule: null,
      location: null,
      phoneHuman: null,
      escalationTriggers: [],
    });

    const result = buildSystemPrompt(config);
    expect(result).toContain('[IDENTIDAD]');
    expect(result).toContain('[NEGOCIO]');
    expect(result).toContain('[REGLAS]');
    expect(result).not.toContain('[CATÁLOGO]');
    expect(result).not.toContain('[PREGUNTAS FRECUENTES]');
  });
});
