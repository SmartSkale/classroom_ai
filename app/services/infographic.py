import asyncio
import json
import logging
import re

from app.core.config import get_settings
from app.schemas.language import (
    OutputLanguage,
    language_display_name,
    language_visible_text_rule,
    normalize_output_language,
)
from app.services import illustration_openai, illustration_opensource
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import Message

logger = logging.getLogger(__name__)


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


def _lang_note(lang: OutputLanguage) -> str:
    """Return a language-specific reminder for infographic prompts."""
    if lang == "english":
        return (
            "All visible text on the poster (title, section headings, short labels) MUST be in English. "
            "Use short labels (2–5 words); avoid long paragraphs or tiny unreadable text."
        )
    name = language_display_name(lang)
    script = language_visible_text_rule(lang, surface="visible text on the poster")
    return (
        f"OUTPUT LANGUAGE is {name}. {script}. "
        "Keep labels 2–5 words. "
        "Do not use English labels except unavoidable scientific symbols or formulas."
    )


def _get_default_visual_prompt(topic: str, output_language: OutputLanguage = "english") -> str:
    """Return a safe fallback prompt when the LLM cannot produce one."""
    label_rule = language_visible_text_rule(output_language, surface="on-poster text labels")
    return (
        f"Educational infographic poster about {topic}: titled header, 4–6 color-coded sections "
        f"with short labels, flowchart arrows connecting ideas, bold icons for key concepts, "
        f"simple chart or process steps, flat vector design, school-friendly palette, "
        f"high contrast, crisp edges, generous whitespace. {label_rule}."
    )


def _prompt_llm(*, topic: str, context_text: str | None, output_language: OutputLanguage) -> str:
    """Build the JSON-only prompt that asks the LLM for an infographic prompt."""
    ctx = (context_text or "").strip()[:8000]
    return (
        "You write ONE detailed image-generation prompt for an educational INFOGRAPHIC "
        "(a single poster/diagram that teaches the topic at a glance).\n"
        f"Topic: {topic}\n"
        f"{_lang_note(output_language)}\n"
        "Requirements for the visual_prompt you write:\n"
        "- Name a clear poster title and 4–6 concrete sections drawn from the lesson.\n"
        "- Describe layout (e.g. top-to-bottom flow, left-right comparison, cycle, timeline).\n"
        "- Include icons, arrows, color-coded regions, and short labels for each section.\n"
        "- Quote the exact on-image title and labels in the required output language "
        "(put quoted label text inside the visual_prompt).\n"
        "- Mention the most important facts/steps from the lesson (not generic fluff).\n"
        "- Style: professional flat-vector educational poster, bold shapes, high contrast.\n"
        "- Do NOT dump raw lesson prose; turn concepts into a visual scene description.\n"
        "- Keep visual_prompt between 200 and 900 characters.\n"
        '- Return ONLY JSON: {"visual_prompt": "<scene description; quote on-image labels '
        'in the required language>"}\n'
        + (f"\nLesson context to reflect (extract key ideas only):\n{ctx}\n" if ctx else "")
    )


async def _generate_visual_prompt_with_retry(
    *,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage,
    llm_provider_name: str,
) -> str:
    """Generate an infographic prompt from the LLM with retries and fallback."""
    settings = get_settings()
    provider = get_llm_provider(vision=False, provider=llm_provider_name)

    last_error: Exception | None = None
    for attempt in range(1, settings.llm_prompt_generation_retries + 1):
        try:
            logger.info(
                f"LLM visual prompt generation attempt {attempt}/{settings.llm_prompt_generation_retries}"
            )
            messages: list[Message] = [
                {
                    "role": "system",
                    "content": (
                        "You output strict JSON only. No explanations. "
                        "visual_prompt must be a concrete scene description for an image model."
                    ),
                },
                {
                    "role": "user",
                    "content": _prompt_llm(
                        topic=topic,
                        context_text=context_text,
                        output_language=output_language,
                    ),
                },
            ]
            raw = await provider.complete_chat(messages, max_tokens=1000, temperature=0.35)
            data = _extract_json_obj(raw) or {}
            vp = str(data.get("visual_prompt") or data.get("prompt") or "").strip()

            if len(vp) >= 40 and len(vp) <= 1200:
                logger.info(f"LLM succeeded on attempt {attempt}, prompt length: {len(vp)}")
                vp = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", vp)
                return vp
            logger.warning(
                f"LLM returned prompt with invalid length {len(vp)} on attempt {attempt}, "
                f"expected 40-1200 chars"
            )
            raise ValueError(f"Prompt length invalid ({len(vp)} chars)")
        except Exception as e:
            last_error = e
            logger.warning(f"LLM attempt {attempt} failed: {e!s}")
            if attempt < settings.llm_prompt_generation_retries:
                await asyncio.sleep(0.5)

    default = _get_default_visual_prompt(topic, output_language)
    logger.warning(
        f"LLM failed after {settings.llm_prompt_generation_retries} attempts "
        f"(last={last_error!s}), using default prompt"
    )
    return default


async def generate_infographic(
    *,
    topic: str,
    context_text: str | None,
    output_language: str,
    stack: str,
    style: str,
) -> tuple[str, str, str]:
    """Generate the final infographic image plus the prompt used to create it."""
    settings = get_settings()
    lang = normalize_output_language(output_language)
    llm_provider_name = "openai" if stack.lower().strip() == "openai" else "ollama"

    logger.info(f"Starting infographic generation for topic: {topic}")
    vp = await _generate_visual_prompt_with_retry(
        topic=topic,
        context_text=context_text,
        output_language=lang,
        llm_provider_name=llm_provider_name,
    )

    label_clause = language_visible_text_rule(lang, surface="visible text on the poster")

    full_prompt = (
        f"Professional educational infographic poster, square 1024x1024 layout: {vp}. "
        f"Clear sections with short readable labels, flowchart arrows, bold icons, "
        f"high-contrast color coding, generous whitespace, crisp vector edges, school-friendly. "
        f"{label_clause}."
    )

    style_suffix = (style or "").strip() or (
        "flat vector educational infographic, bold icons, clean arrows, high contrast, "
        "short readable labels, no watermark, no logo, crisp edges"
    )

    used_prompt = f"{full_prompt}\n\nStyle: {style_suffix}"

    try:
        if stack.lower().strip() == "opensource":
            b64, mime = await illustration_opensource.generate_illustration_png_b64(
                settings,
                prompt=full_prompt,
                style_suffix=style_suffix,
            )
        else:
            b64, mime = await illustration_openai.generate_illustration_png_b64(
                settings,
                prompt=full_prompt,
                style_suffix=style_suffix,
            )
        logger.info("Infographic generated successfully")
    except Exception as e:
        logger.error(f"Infographic image generation failed: {e!s}")
        raise

    return b64, mime, used_prompt[:2000]
