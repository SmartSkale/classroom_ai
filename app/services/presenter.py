import json

from app.schemas.language import OutputLanguage
from app.schemas.presenter import PresenterScript, PresenterSegment
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import Message

CONTEXT_LIMIT = 20000
EXPRESSIONS = {"neutral", "happy", "excited", "thinking"}


def _lang_rule(lang: OutputLanguage) -> str:
    if lang == "english":
        return "Write the narration in English."
    if lang == "hindi":
        return "Write the narration in Hindi (Devanagari script)."
    return "Write the narration in Roman Hindi (Latin letters only, no Devanagari)."


def _prompt(*, topic: str, segment_count: int, output_language: OutputLanguage, context_text: str | None) -> str:
    ctx = (context_text or "").strip()[:CONTEXT_LIMIT]
    return (
        "You are a warm, clear teacher who presents a lesson on camera to students.\n"
        f"Topic: {topic}\n"
        f"Number of segments: {segment_count}\n"
        f"{_lang_rule(output_language)}\n\n"
        "Write a short spoken presentation that explains the topic step by step, the way a teacher talks.\n"
        "- Each segment has a heading (max 6 words) and a narration of 2 to 4 sentences (25 to 60 words) that "
        "sounds natural when spoken aloud. Address the students directly.\n"
        "- Start with a friendly hook and end with a short recap.\n"
        "- Teach the ideas; do not mention the source, the material, or the text.\n"
        "- expression is one of: neutral, happy, excited, thinking. Match it to the tone of the segment.\n"
        "- No markdown, no stage directions, no emojis.\n\n"
        'Return JSON only: {"title": "...", "segments": [{"heading": "...", "narration": "...", "expression": "..."}]}\n'
        + (f"\nMaterial to explain (ground every fact in it):\n{ctx}\n" if ctx else "")
    )


def _extract_json_obj(raw: str) -> dict | None:
    raw = raw.strip()
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(raw[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _segments(raw_items: object, topic: str) -> list[PresenterSegment]:
    if not isinstance(raw_items, list):
        return []
    out: list[PresenterSegment] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        narration = " ".join(str(item.get("narration") or "").split())
        if len(narration) < 20:
            continue
        expression = str(item.get("expression") or "neutral").lower()
        out.append(
            PresenterSegment(
                heading=(" ".join(str(item.get("heading") or f"Part {len(out) + 1}").split()) or f"Part {len(out) + 1}")[:120],
                narration=narration[:1200],
                expression=expression if expression in EXPRESSIONS else "neutral",
            )
        )
    return out


async def generate_script(
    *,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage,
    segment_count: int,
    llm_provider: str,
) -> PresenterScript:
    provider = get_llm_provider(vision=False, provider=llm_provider)
    messages: list[Message] = [
        {"role": "system", "content": "You write spoken lesson scripts and output strict JSON only."},
        {
            "role": "user",
            "content": _prompt(
                topic=topic,
                segment_count=segment_count,
                output_language=output_language,
                context_text=context_text,
            ),
        },
    ]
    raw = await provider.complete_chat(messages, max_tokens=3000, temperature=0.5)
    data = _extract_json_obj(raw) or {}
    segments = _segments(data.get("segments"), topic)[:segment_count]
    if len(segments) < 2:
        raise ValueError("The model did not return a usable presentation script. Check that the model is running, then try again.")
    title = " ".join(str(data.get("title") or topic).split())[:200] or topic
    return PresenterScript(title=title, output_language_used=output_language, segments=segments)
