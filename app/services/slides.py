import asyncio
import json
import logging
import re
import uuid

from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.language import OutputLanguage
from app.schemas.slides import SlideDeckResponse, SlideItem
from app.services import illustration_openai
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import Message
from app.services.pexels_stock import fetch_landscape_photo_bytes
from app.services.slide_design import (
    LAYOUT_PHOTO,
    RenderedSlide,
    background_jpeg,
    build_pptx_bytes,
    cover_jpeg,
    layout_for,
    palette_for,
    photo_png,
)

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_decks: dict[str, tuple[bytes, str]] = {}
_media: dict[str, dict[str, tuple[bytes, str]]] = {}

# Image generation runs in parallel, but not all at once, to stay under API rate limits.
_IMAGE_CONCURRENCY = 3
_IMAGE_STYLE = (
    "cinematic, photorealistic, soft dramatic lighting, shallow depth of field, rich colour, "
    "wide 3:2 composition, no text, no letters, no labels, no watermark, no logos"
)


def _lang_rule(lang: OutputLanguage) -> str:
    if lang == "english":
        return "All slide text must be in English."
    if lang == "hindi":
        return "All slide text must be in Hindi (Devanagari script)."
    return "All slide text must be in Roman Hindi (Latin letters only, no Devanagari)."


def _prompt(
    *,
    topic: str,
    slide_count: int,
    output_language: OutputLanguage,
    context_text: str | None,
) -> str:
    ctx = (context_text or "").strip()
    ctx_excerpt = ctx[:26000]
    return (
        "You are an expert teacher preparing a classroom slide deck with a modern, visual style.\n"
        f"Topic: {topic}\n"
        f"Number of content slides (not counting the opening): {slide_count}\n"
        f"{_lang_rule(output_language)}\n\n"
        "Return JSON only (no markdown). Keys:\n"
        "- deck_title: short presentation title (max 80 characters)\n"
        "- cover_image_prompt: English, 25 to 45 words, describing one striking scene that represents the whole topic\n"
        f"- slides: array of exactly {slide_count} objects. Each object has:\n"
        "  title (short slide heading, max 60 characters),\n"
        "  bullets (array of 3 to 5 SHORT points, each under 15 words),\n"
        "  speaker_notes (2 to 4 sentences the teacher can say aloud),\n"
        "  image_prompt (English, 25 to 45 words): a specific visual scene that teaches or illustrates this slide, "
        "with subject, setting, camera angle, lighting and mood. Do not ask for text, labels or logos in the image,\n"
        "  image_query (English, 4 to 8 words): stock-photo search phrase for the same idea.\n\n"
        "Rules:\n"
        "- Bullets must be teaching points, not slide design instructions.\n"
        "- Order slides as you would teach: intro → concepts → examples → summary.\n"
        "- Each image_prompt must be different and concrete; avoid generic classroom stock scenes.\n"
        "- Ground content in the Context when it is provided.\n"
        "- No HTML or markdown in strings.\n"
        + (f"\nContext material:\n{ctx_excerpt}\n" if ctx_excerpt else "")
    )


def _extract_json_obj(raw: str) -> dict | None:
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


def _normalize_slides(raw_slides: list, *, expected: int, topic: str) -> list[SlideItem]:
    out: list[SlideItem] = []
    for i, item in enumerate(raw_slides[:expected]):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", f"Slide {i + 1}")).strip()[:200]
        bullets_raw = item.get("bullets") or []
        if not isinstance(bullets_raw, list):
            bullets_raw = [str(bullets_raw)]
        bullets = [str(b).strip()[:300] for b in bullets_raw if str(b).strip()][:6]
        if not bullets:
            bullets = [f"Key idea {i + 1} about {topic}."]
        notes = item.get("speaker_notes")
        sn = str(notes).strip()[:4000] if notes else None
        ip = item.get("image_prompt")
        iq = item.get("image_query")
        try:
            out.append(
                SlideItem(
                    title=title or f"Slide {i + 1}",
                    bullets=bullets,
                    speaker_notes=sn,
                    image_prompt=str(ip).strip()[:1000] if ip else None,
                    image_query=str(iq).strip()[:200] if iq else None,
                )
            )
        except ValidationError:
            continue
    while len(out) < expected:
        n = len(out)
        out.append(
            SlideItem(
                title=f"{topic} — point {n + 1}",
                bullets=["Review this section in the chapter.", "Ask students for one example."],
                speaker_notes=None,
            )
        )
    return out[:expected]


async def _find_photo(
    *,
    prompt: str,
    fallback_query: str,
    use_openai: bool,
    pexels_key: str,
) -> tuple[bytes | None, str | None]:
    """Return (image bytes, attribution). OpenAI generates the image; Pexels is the fallback."""
    settings = get_settings()
    if use_openai and settings.openai_api_key:
        try:
            return await illustration_openai.generate_image_bytes(
                settings,
                prompt=f"{prompt}. Style: {_IMAGE_STYLE}",
            ), None
        except Exception as e:  # noqa: BLE001
            logger.warning("OpenAI slide image failed, falling back: %s", e)
    if pexels_key:
        out = await fetch_landscape_photo_bytes(pexels_key, fallback_query)
        if out:
            raw, _mime, attr = out
            return raw, attr
    return None, None


def _media_url(deck_id: str, name: str) -> str:
    return f"/api/v1/slides/{deck_id}/media/{name}"


async def generate_slide_deck(
    *,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage,
    slide_count: int,
    llm_provider: str,
) -> SlideDeckResponse:
    settings = get_settings()
    provider = get_llm_provider(vision=False, provider=llm_provider)
    messages: list[Message] = [
        {"role": "system", "content": "You output strict JSON only for slide deck generation."},
        {
            "role": "user",
            "content": _prompt(
                topic=topic,
                slide_count=slide_count,
                output_language=output_language,
                context_text=context_text,
            ),
        },
    ]
    raw = await provider.complete_chat(messages, max_tokens=8000, temperature=0.35)
    data = _extract_json_obj(raw) or {}
    deck_title = str(data.get("deck_title", topic)).strip()[:200] or topic
    cover_prompt = str(data.get("cover_image_prompt") or f"Cinematic scene about {topic}").strip()
    raw_slides = data.get("slides")
    if not isinstance(raw_slides, list):
        raw_slides = []
    slides = _normalize_slides(raw_slides, expected=slide_count, topic=topic)

    use_openai = llm_provider == "openai"
    pexels_key = (settings.pexels_api_key or "").strip()
    sem = asyncio.Semaphore(_IMAGE_CONCURRENCY)

    async def _limited(prompt: str, fallback: str) -> tuple[bytes | None, str | None]:
        async with sem:
            return await _find_photo(
                prompt=prompt,
                fallback_query=fallback,
                use_openai=use_openai,
                pexels_key=pexels_key,
            )

    cover_task = _limited(cover_prompt, topic)
    photo_tasks = [
        _limited(s.image_prompt or s.title, s.image_query or topic) for s in slides
    ]
    cover_result, *photo_results = await asyncio.gather(cover_task, *photo_tasks)

    cover_raw, _cover_attr = cover_result
    rendered: list[RenderedSlide] = [
        RenderedSlide(
            kind="cover",
            layout="cover",
            title=deck_title,
            bullets=[topic],
            speaker_notes=None,
            background=cover_jpeg(cover_raw, 0),
            photo=None,
            accent=palette_for(0)[2],
        )
    ]
    final_slides: list[SlideItem] = [
        SlideItem(title=deck_title, bullets=[topic], layout="cover", background_url=None)
    ]

    for i, (s, (photo_raw, attr)) in enumerate(zip(slides, photo_results)):
        layout = layout_for(i) if photo_raw else "text"
        palette_index = i + 1
        notes_parts = [s.speaker_notes or "", attr or ""]
        notes = "\n\n".join(p for p in notes_parts if p).strip() or None
        photo = photo_png(photo_raw, layout) if photo_raw and layout in LAYOUT_PHOTO else None
        rendered.append(
            RenderedSlide(
                kind="content",
                layout=layout,
                title=s.title,
                bullets=s.bullets,
                speaker_notes=notes,
                background=background_jpeg(palette_index),
                photo=photo,
                accent=palette_for(palette_index)[2],
            )
        )
        final_slides.append(
            s.model_copy(update={"layout": layout, "photo_attribution": attr})
        )

    deck_id = f"sdeck_{uuid.uuid4().hex[:16]}"
    media: dict[str, tuple[bytes, str]] = {"bg0": (rendered[0].background, "image/jpeg")}
    for idx, r in enumerate(rendered[1:], start=1):
        media[f"bg{idx}"] = (r.background, "image/jpeg")
        if r.photo is not None:
            media[f"img{idx}"] = (r.photo, "image/png")

    final_slides[0] = final_slides[0].model_copy(update={"background_url": _media_url(deck_id, "bg0")})
    for idx in range(1, len(final_slides)):
        urls = {"background_url": _media_url(deck_id, f"bg{idx}")}
        if rendered[idx].photo is not None:
            urls["image_url"] = _media_url(deck_id, f"img{idx}")
        final_slides[idx] = final_slides[idx].model_copy(update=urls)

    pptx_bytes = build_pptx_bytes(deck_title=deck_title, slides=rendered)
    filename = f"{_safe_filename(deck_title)}.pptx"

    async with _lock:
        _decks[deck_id] = (pptx_bytes, filename)
        _media[deck_id] = media

    return SlideDeckResponse(
        deck_id=deck_id,
        deck_title=deck_title,
        filename=filename,
        slides=final_slides,
    )


def _safe_filename(name: str) -> str:
    s = re.sub(r'[<>:"/\\|?*]', "", name).strip()
    s = re.sub(r"\s+", " ", s)[:100]
    return s or "ClassroomAI-slides"


async def get_deck_file(deck_id: str) -> tuple[bytes, str] | None:
    async with _lock:
        return _decks.get(deck_id)


async def get_media_file(deck_id: str, name: str) -> tuple[bytes, str] | None:
    async with _lock:
        return _media.get(deck_id, {}).get(name)
