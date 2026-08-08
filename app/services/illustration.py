"""Educational illustration generation with LLM prompt rewriting."""

from __future__ import annotations

import asyncio
import json
import logging
import re

from app.core.config import get_settings
from app.schemas.language import (
    OutputLanguage,
    language_prompt_label_block,
    language_visible_text_rule,
    normalize_output_language,
)
from app.services import illustration_openai, illustration_opensource
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import Message

logger = logging.getLogger(__name__)

_RAW_TEXT_MARKERS = (
    "=== page",
    "____",
    "\n\n\n",
    "chapter",
    "figure ",
    "table of contents",
)


def _extract_json_obj(raw: str) -> dict | None:
    """Parse a JSON object from model output, tolerating extra prose around it."""
    raw = raw.strip()
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(raw[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _looks_like_raw_lesson_dump(text: str) -> bool:
    """Heuristic: long / OCR-like blobs should not be sent straight to the image API."""
    t = (text or "").strip().lower()
    if len(t) > 500:
        return True
    if sum(1 for c in t if c == "\n") >= 4:
        return True
    return any(m in t for m in _RAW_TEXT_MARKERS)


def _default_illustration_prompt(topic: str, output_language: OutputLanguage = "english") -> str:
    """Fallback scene when the LLM cannot rewrite the prompt."""
    label_rule = language_visible_text_rule(output_language, surface="short labels")
    return (
        f"Clean educational textbook illustration of {topic}: one clear focal subject, "
        f"accurate proportions, soft natural lighting, subtle classroom-friendly colors, "
        f"optional short labels for important parts, uncluttered background, no watermark. "
        f"{label_rule}."
    )


def _prompt_llm(*, topic: str, context_text: str | None, output_language: OutputLanguage) -> str:
    """Ask the LLM for a single illustration scene prompt grounded in the lesson."""
    ctx = (context_text or "").strip()[:6000]
    lang = language_prompt_label_block(output_language)
    return (
        "You write ONE detailed image-generation prompt for a single educational ILLUSTRATION "
        "(one scene or diagram — not a multi-panel infographic poster).\n"
        f"Topic: {topic}\n"
        f"{lang}"
        "Requirements for the visual_prompt you write:\n"
        "- Describe one coherent visual that teaches the main idea of the lesson.\n"
        "- Prefer a textbook-style diagram or realistic educational scene with a clear focal subject.\n"
        "- Name concrete objects, relationships, and spatial arrangement.\n"
        "- Short readable labels (2–5 words) for key parts are OK; no paragraphs or tiny text.\n"
        "- Style cues: accurate proportions, soft lighting, school-friendly colors, no watermark.\n"
        "- Do NOT copy-paste lesson prose; synthesize a visual scene description.\n"
        "- Keep visual_prompt between 150 and 800 characters.\n"
        '- Return ONLY JSON: {"visual_prompt": "<scene description; quote on-image labels '
        'in the required language>"}\n'
        + (f"\nLesson context (extract the main visual idea):\n{ctx}\n" if ctx else "")
    )


async def rewrite_illustration_prompt(
    *,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage | str = "english",
    llm_provider_name: str = "openai",
) -> str:
    """Turn topic + lesson text into a focused image-model prompt."""
    settings = get_settings()
    lang = normalize_output_language(output_language)
    provider = get_llm_provider(vision=False, provider=llm_provider_name)

    for attempt in range(1, settings.llm_prompt_generation_retries + 1):
        try:
            logger.info(
                f"LLM illustration prompt rewrite attempt {attempt}/{settings.llm_prompt_generation_retries}"
            )
            messages: list[Message] = [
                {
                    "role": "system",
                    "content": (
                        "You output strict JSON only. visual_prompt must describe a single "
                        "educational illustration scene for an image model."
                    ),
                },
                {
                    "role": "user",
                    "content": _prompt_llm(
                        topic=topic,
                        context_text=context_text,
                        output_language=lang,
                    ),
                },
            ]
            raw = await provider.complete_chat(messages, max_tokens=900, temperature=0.35)
            data = _extract_json_obj(raw) or {}
            vp = str(data.get("visual_prompt") or data.get("prompt") or "").strip()
            if len(vp) >= 40 and len(vp) <= 1000:
                vp = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", vp)
                logger.info(f"Illustration prompt rewrite succeeded, length={len(vp)}")
                return vp
            raise ValueError(f"Prompt length invalid ({len(vp)} chars)")
        except Exception as e:
            logger.warning(f"Illustration prompt rewrite attempt {attempt} failed: {e!s}")
            if attempt < settings.llm_prompt_generation_retries:
                await asyncio.sleep(0.5)

    logger.warning("Illustration prompt rewrite failed; using default scene prompt")
    return _default_illustration_prompt(topic, lang)


async def resolve_illustration_prompt(
    *,
    prompt: str | None,
    topic: str | None,
    context_text: str | None,
    output_language: str = "english",
    stack: str = "openai",
) -> str:
    """Pick/rewrite the prompt that will be sent to the image model."""
    topic_clean = (topic or "").strip()
    ctx = (context_text or "").strip() or None
    prompt_clean = (prompt or "").strip()
    llm_name = "openai" if stack.lower().strip() == "openai" else "ollama"

    # Preferred path: explicit topic (+ optional context) → LLM scene brief
    if topic_clean and (ctx or _looks_like_raw_lesson_dump(prompt_clean) or not prompt_clean):
        return await rewrite_illustration_prompt(
            topic=topic_clean,
            context_text=ctx or (prompt_clean if _looks_like_raw_lesson_dump(prompt_clean) else None),
            output_language=output_language,
            llm_provider_name=llm_name,
        )

    # Client sent a long dump as `prompt` only
    if prompt_clean and _looks_like_raw_lesson_dump(prompt_clean):
        derived_topic = topic_clean or prompt_clean.split(".", 1)[0][:80] or "Lesson concept"
        return await rewrite_illustration_prompt(
            topic=derived_topic,
            context_text=prompt_clean,
            output_language=output_language,
            llm_provider_name=llm_name,
        )

    if prompt_clean:
        return prompt_clean[:2000]

    if topic_clean:
        return await rewrite_illustration_prompt(
            topic=topic_clean,
            context_text=None,
            output_language=output_language,
            llm_provider_name=llm_name,
        )

    raise ValueError("Illustration requires a prompt or topic.")


DEFAULT_ILLUSTRATION_STYLE = (
    "Clean textbook-style educational illustration, accurate proportions, soft natural lighting, "
    "school-friendly colors, optional short readable labels for key parts, uncluttered composition, "
    "no watermark, no logo, no dense paragraphs of text."
)


async def generate_ai_illustration(
    *,
    prompt: str | None,
    topic: str | None,
    context_text: str | None,
    output_language: str,
    stack: str,
    style: str | None,
) -> tuple[str, str, str]:
    """Rewrite (if needed) and render an educational illustration. Returns b64, mime, prompt used."""
    settings = get_settings()
    lang = normalize_output_language(output_language)
    visual_prompt = await resolve_illustration_prompt(
        prompt=prompt,
        topic=topic,
        context_text=context_text,
        output_language=lang,
        stack=stack,
    )
    label_clause = language_visible_text_rule(lang, surface="visible labels")
    visual_prompt = f"{visual_prompt}. {label_clause}."
    style_suffix = (style or "").strip() or DEFAULT_ILLUSTRATION_STYLE
    used = f"{visual_prompt}\n\nStyle: {style_suffix}"

    if stack.lower().strip() == "opensource":
        b64, mime = await illustration_opensource.generate_illustration_png_b64(
            settings,
            prompt=visual_prompt,
            style_suffix=style_suffix,
        )
    else:
        b64, mime = await illustration_openai.generate_illustration_png_b64(
            settings,
            prompt=visual_prompt,
            style_suffix=style_suffix,
        )
    return b64, mime, used[:2000]
