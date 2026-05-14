"""Build dynamic system prompts per tenant configuration."""
from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from apps.api.models.tenant import TenantConfig


SYSTEM_PROMPT_TEMPLATE = """\
[IDENTIDAD]
Eres {bot_name}, asistente virtual de {business_name}.
Personalidad: {personality}
Idioma principal: {language}
Fecha y hora actual: {current_datetime}

[NEGOCIO]
{business_description}

Horario de atención: {schedule_text}
Ubicación: {location}
{contact_info}

[CAPACIDADES ACTIVAS]
{capabilities_text}

[CATÁLOGO / SERVICIOS]
{catalog_text}

[PREGUNTAS FRECUENTES]
{faq_text}

[INSTRUCCIONES ESPECÍFICAS]
{custom_instructions}

[REGLAS OBLIGATORIAS]
- Responde SIEMPRE en {language}.
- Sé {personality_adj}: {personality_guide}
- Nunca inventes precios, productos ni disponibilidad no listados.
- Si no sabes algo, di que lo verificarás y ofrece contacto humano.
- Nunca compartas datos personales de otros clientes.
- Para pedidos o citas, confirma SIEMPRE los detalles antes de guardar.
- Deriva a un humano cuando: {escalation_triggers_text}

[FORMATO DE RESPUESTAS]
- Respuestas cortas y naturales (máximo 3 párrafos).
- Usa emojis con moderación (1-2 por mensaje máximo).
- No uses markdown (el usuario lo ve como texto plano en WhatsApp).
- Si necesitas mostrar una lista, usa números o guiones simples.
"""

PERSONALITY_GUIDES = {
    "profesional": {
        "adj": "profesional y cordial",
        "guide": "usa lenguaje formal pero amigable, evita jerga.",
    },
    "casual": {
        "adj": "casual y cercano",
        "guide": "usa lenguaje coloquial, tutea al cliente, sé entusiasta.",
    },
    "amigable": {
        "adj": "amigable y servicial",
        "guide": "sé cálido, empático, usa el nombre del cliente cuando lo sepas.",
    },
}


def build_system_prompt(config: TenantConfig, timezone: str = "America/Mexico_City") -> str:
    tz = ZoneInfo(timezone)
    now = datetime.now(tz).strftime("%A %d de %B %Y, %H:%M")

    personality = config.personality or "amigable"
    pg = PERSONALITY_GUIDES.get(personality, PERSONALITY_GUIDES["amigable"])

    capabilities = []
    if config.orders_enabled:
        capabilities.append("- Tomar y gestionar pedidos/órdenes")
    if config.appointments_enabled:
        capabilities.append("- Agendar y consultar citas")
    capabilities.append("- Responder preguntas frecuentes")
    capabilities.append("- Captar y calificar leads")

    catalog_text = _format_catalog(config.catalog_data)
    faq_text = _format_faqs(config.faq_data)
    schedule_text = _format_schedule(config.schedule)

    contact_lines = []
    if config.phone_human:
        contact_lines.append(f"Teléfono de atención humana: {config.phone_human}")
    if config.website:
        contact_lines.append(f"Sitio web: {config.website}")

    triggers = config.escalation_triggers or ["quiero hablar con alguien", "agente", "humano", "reclamación"]

    return SYSTEM_PROMPT_TEMPLATE.format(
        bot_name=config.bot_name or "Asistente",
        business_name=config.business_name,
        personality=personality,
        personality_adj=pg["adj"],
        personality_guide=pg["guide"],
        language=config.language or "español",
        current_datetime=now,
        business_description=config.business_description or "",
        schedule_text=schedule_text,
        location=config.location or "No especificada",
        contact_info="\n".join(contact_lines),
        capabilities_text="\n".join(capabilities),
        catalog_text=catalog_text,
        faq_text=faq_text,
        custom_instructions=config.custom_instructions or "Ninguna.",
        escalation_triggers_text=", ".join(f'"{t}"' for t in triggers),
    )


def _format_catalog(catalog_data: dict | list | None) -> str:
    if not catalog_data:
        return "No hay catálogo configurado."
    if isinstance(catalog_data, list):
        lines = []
        for item in catalog_data:
            name = item.get("name", "")
            price = item.get("price", "")
            desc = item.get("description", "")
            line = f"- {name}"
            if price:
                line += f" — ${price}"
            if desc:
                line += f": {desc}"
            lines.append(line)
        return "\n".join(lines)
    return json.dumps(catalog_data, ensure_ascii=False, indent=2)


def _format_faqs(faq_data: list | None) -> str:
    if not faq_data:
        return "No hay FAQs configuradas."
    lines = []
    for faq in faq_data:
        q = faq.get("question", "")
        a = faq.get("answer", "")
        lines.append(f"P: {q}\nR: {a}")
    return "\n\n".join(lines)


def _format_schedule(schedule: dict | None) -> str:
    if not schedule:
        return "No especificado."
    days_es = {
        "monday": "Lunes", "tuesday": "Martes", "wednesday": "Miércoles",
        "thursday": "Jueves", "friday": "Viernes", "saturday": "Sábado", "sunday": "Domingo",
    }
    lines = []
    for day_key, label in days_es.items():
        day_info = schedule.get(day_key)
        if day_info:
            if day_info.get("closed"):
                lines.append(f"{label}: Cerrado")
            else:
                lines.append(f"{label}: {day_info.get('open', '')} - {day_info.get('close', '')}")
    return "\n".join(lines) if lines else "No especificado."
