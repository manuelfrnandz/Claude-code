import anthropic
import structlog

from apps.api.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_client: anthropic.AsyncAnthropic | None = None


def get_claude_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def chat(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float = 0.7,
) -> str:
    """Send a chat completion request to Claude and return the text response."""
    client = get_claude_client()
    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=max_tokens or settings.claude_max_tokens,
        temperature=temperature,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text


async def chat_structured(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    max_tokens: int | None = None,
) -> tuple[str | None, list[dict]]:
    """Request a structured response via tool use. Returns (text, tool_calls)."""
    client = get_claude_client()
    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=max_tokens or settings.claude_max_tokens,
        system=system_prompt,
        messages=messages,
        tools=tools,  # type: ignore[arg-type]
        tool_choice={"type": "auto"},
    )

    text_parts = [b.text for b in response.content if b.type == "text"]
    tool_calls = [
        {"name": b.name, "input": b.input}
        for b in response.content
        if b.type == "tool_use"
    ]

    return (" ".join(text_parts) or None), tool_calls


async def summarize_history(messages: list[dict]) -> str:
    """Compress a long conversation history into a short summary."""
    prompt = (
        "Summarize the following WhatsApp conversation in 3-5 bullet points, "
        "focusing on: customer intent, key data collected (name, order, preferences), "
        "current flow state, and any unresolved questions. Be concise.\n\n"
        + "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
    )
    return await chat(
        system_prompt="You are a conversation summarizer. Be concise and factual.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.0,
    )
