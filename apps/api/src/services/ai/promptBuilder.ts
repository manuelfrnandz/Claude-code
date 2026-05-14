import type { TenantConfig } from '../../types';

interface CatalogItem {
  name: string;
  price?: number | string;
  description?: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Build the system prompt for a tenant's bot.
 * If tenant.systemPrompt is set, returns it verbatim — the business owner
 * has full control. Otherwise builds from structured config fields.
 */
export function buildSystemPrompt(tenant: TenantConfig): string {
  if (tenant.systemPrompt) return tenant.systemPrompt;

  const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const sections: string[] = [];

  // ─── Identity ────────────────────────────────────────────────────────────
  sections.push(
    `[IDENTIDAD]\nEres ${tenant.botName}, asistente virtual de ${tenant.businessName}.` +
      `\nPersonalidad: ${tenant.personality}.` +
      `\nIdioma: responde siempre en ${tenant.language}.` +
      `\nFecha y hora actual: ${now}.`,
  );

  // ─── Business ─────────────────────────────────────────────────────────────
  const bizLines = [`[NEGOCIO]\nNombre: ${tenant.businessName}`];
  if (tenant.businessDescription) bizLines.push(`Descripción: ${tenant.businessDescription}`);
  if (tenant.location) bizLines.push(`Ubicación: ${tenant.location}`);
  if (tenant.schedule) bizLines.push(`Horario: ${JSON.stringify(tenant.schedule)}`);
  sections.push(bizLines.join('\n'));

  // ─── Catalog ──────────────────────────────────────────────────────────────
  if (Array.isArray(tenant.catalogData) && tenant.catalogData.length > 0) {
    const items = (tenant.catalogData as CatalogItem[])
      .map((p) => {
        const price = p.price !== undefined ? ` — $${p.price}` : '';
        const desc = p.description ? `: ${p.description}` : '';
        return `• ${p.name}${price}${desc}`;
      })
      .join('\n');
    sections.push(`[CATÁLOGO]\n${items}`);
  }

  // ─── FAQs ─────────────────────────────────────────────────────────────────
  if (Array.isArray(tenant.faqData) && tenant.faqData.length > 0) {
    const faqs = (tenant.faqData as FaqItem[])
      .map((f) => `P: ${f.question}\nR: ${f.answer}`)
      .join('\n\n');
    sections.push(`[PREGUNTAS FRECUENTES]\n${faqs}`);
  }

  // ─── Rules ────────────────────────────────────────────────────────────────
  const rules = [
    'Responde de forma concisa y útil.',
    'Si no sabes algo, dilo con honestidad.',
    'No inventes precios ni información.',
  ];
  if (tenant.phoneHuman) {
    rules.push(`Si el cliente necesita ayuda humana, indícale que puede contactar a: ${tenant.phoneHuman}`);
  }
  if (tenant.escalationTriggers.length > 0) {
    rules.push(`Escala a un humano si el cliente menciona: ${tenant.escalationTriggers.join(', ')}`);
  }
  sections.push(`[REGLAS]\n${rules.map((r) => `• ${r}`).join('\n')}`);

  return sections.join('\n\n');
}
