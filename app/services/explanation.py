import asyncio
import base64
import functools
import json
import re

import anyio
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.schemas.explain import ExplainResponse, VisualAssetBrief
from app.schemas.language import OutputLanguage, language_display_name, language_script_rule
from app.services import illustration_openai, illustration_opensource
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import ImageUrlPart, Message, TextPart
from app.services.explanation_grounding import (
    grounding_source_text,
    learner_facing_char_count,
    minimum_explanation_chars,
    minimum_markdown_chars,
    validate_explanation_grounding,
)
from app.services.pdf_extract import extract_pdf_to_text


def _user_language_block(output_language: OutputLanguage, *, closing: bool = False) -> str:
    """Strong, repeated instructions; JSON schema examples were biasing models toward English."""
    if output_language == "english":
        line = "OUTPUT_LANGUAGE=english. All learner-facing strings must be in English."
    elif output_language == "roman_hindi":
        line = (
            "OUTPUT_LANGUAGE=roman_hindi (Hindi in Latin letters only). "
            "All learner-facing strings — explanation_markdown, simple_examples, "
            "visual_brief title/description, suggested_followup_topics, video_lesson_prompt — "
            "MUST be Hindi written with A–Z letters only (e.g. \"Prakash ki paravartan\", "
            "\"Darpan par padne wala kon\"). "
            "Do NOT use Devanagari (no Hindi script). "
            "JSON keys stay English; enum tokens kind/suggested_format stay as specified. "
            "Mermaid labels: Roman Hindi or very short English. "
            "Translate the teaching from the chapter even if the chapter is English."
        )
    else:
        name = language_display_name(output_language)
        line = (
            f"OUTPUT_LANGUAGE={output_language}. "
            f"All learner-facing strings — explanation_markdown, simple_examples, "
            f"visual_brief title/description, suggested_followup_topics, video_lesson_prompt — "
            f"MUST be in {name}. "
            f"{language_script_rule(output_language)} "
            "JSON keys stay English; enum tokens kind/suggested_format stay as specified. "
            "Translate from the chapter if it is in another language."
        )
    tag = "FINAL CHECK — " if closing else ""
    return f"{tag}{line}\n\n"


_GROUNDING_RULES = """
SOURCE FIDELITY (critical):
- Base every fact, definition, example, and diagram ONLY on the chapter content provided in the user message.
- Do NOT invent topics, formulas, names, dates, or examples that are not supported by the source.
- If the source is unclear or too short, say so briefly in explanation_markdown instead of guessing.
- topic_hint (if any) is only the lesson TITLE — still teach ALL major ideas in the full chapter, not just the title phrase.
- simple_examples must reuse concrete details (numbers, objects, terms) that appear in the source when possible.
"""

_PDF_COVERAGE_RULES = """
UPLOADED PDF (critical):
- The chapter content came from a multi-page PDF. Markers like "=== Page N ===" and "[Table …]" show structure.
- Cover EVERY major section, definition, process, formula, and important table from ALL pages — not just page 1.
- Add a ### section per major heading/topic found in the source when the document is long.
- Include numerical examples, worked steps, and vocabulary from across the document.
- Do NOT produce a one-paragraph summary when the source has multiple pages or sections.
"""

_JSON_CONTRACT = """
Return a single JSON object only (no markdown code fences).
You MUST use the exact key names below. Do not return only book metadata (title, author, publisher, text)
as a substitute — the full lesson must live in explanation_markdown with the other required keys.
Keys (keep these key names in English): explanation_markdown (string), simple_examples (array of strings),
visual_briefs (array of {title, description, kind, suggested_format}),
suggested_followup_topics (array of strings), video_lesson_prompt (string or null), mermaid_diagram (string or null),
diagram_caption (string or null).

Rules:
- explanation_markdown: Must be clear, textbook-style Markdown in OUTPUT_LANGUAGE only. Use this structure (headings in OUTPUT_LANGUAGE):
  * One ## title line for the lesson topic (use topic_hint as the title when provided).
  * ### sections in order (add more ### sections when the source has multiple topics): Main ideas; Step-by-step (or reasoning); Real-life / numerical examples; Key terms; Quick recap.
  * For long chapters: write a thorough lesson — multiple ### sections, bullet lists, and full paragraphs. Aim to teach the whole chapter, not a short overview.
  * Use **bold** for important terms, bullet lists where helpful, and complete paragraphs (3–6 sentences each).
  * Do NOT wrap the whole explanation in a single code block. No English mixed in when OUTPUT_LANGUAGE is not english.
- simple_examples: At least 3 items (use 4–6 when the source is long). Each string is ONE concrete example grounded in the source: include numbers/units when the topic allows, or a specific everyday situation drawn from the chapter (e.g. "If distance is 2 m and …"). Avoid vague one-liners like "study hard".
- kind must be one of: diagram, analogy_illustration, timeline, graph_concept, animation_idea, other.
- suggested_format must be one of: mermaid, animation_storyboard, svg_or_image.
- Put at least 2 items in visual_briefs; use full sentences in title and description tied to the source chapter.
- mermaid_diagram: valid Mermaid v10+ syntax only, or null. Prefer flowchart TD or graph LR. First line MUST be the diagram keyword (no title line before it). Use ASCII-only node IDs (A, B, C, …). Put ALL label text in double quotes: A["Light source"] --> B["Mirror"]. Use --> for links. Avoid raw parentheses inside unquoted brackets. Do NOT put a second copy of the diagram inside explanation_markdown fenced blocks — only here in mermaid_diagram. Newlines in JSON must be escaped as \\n.
- diagram_caption: If mermaid_diagram is non-null, add 1–3 sentences in OUTPUT_LANGUAGE explaining what the diagram shows (a legend: parts, arrows, or how to read it). If no diagram, use null.

LANGUAGE: Every string that students will read MUST follow OUTPUT_LANGUAGE from the messages above — not English unless OUTPUT_LANGUAGE is english.
"""

_PAGE_MARKER_RE = re.compile(r"^=== Page (\d+) ===", re.MULTILINE)


def _count_pdf_pages(text: str) -> int:
    return len(_PAGE_MARKER_RE.findall(text))


def _looks_like_pdf_extraction(text: str) -> bool:
    return bool(_PAGE_MARKER_RE.search(text))


def _length_guidance(source_len: int, *, from_pdf: bool) -> str:
    target = minimum_explanation_chars(source_len)
    pages_note = (
        " Teach all pages/sections from the uploaded PDF."
        if from_pdf
        else ""
    )
    return (
        f"LENGTH: The source is about {source_len} characters.{pages_note} "
        f"Write a complete lesson — explanation_markdown alone should be at least "
        f"~{target} characters (longer is better when the source is long)."
    )


def _system_prompt(
    output_language: OutputLanguage,
    topic_hint: str | None,
    *,
    from_pdf: bool = False,
    source_len: int = 0,
) -> str:
    """Build the system prompt that steers the explanation model."""
    if topic_hint:
        focus = (
            f" Use topic_hint \"{topic_hint}\" as the lesson ## title, but still explain "
            "ALL major ideas from the full chapter content — do not limit the lesson to "
            "only the title phrase."
        )
    else:
        focus = ""
    if output_language == "english":
        lang = "Learner-facing text: English only."
    elif output_language == "roman_hindi":
        lang = "Learner-facing text: Roman Hindi only (Hindi in Latin alphabet, no Devanagari)."
    else:
        lang = (
            f"Learner-facing text: {language_display_name(output_language)} only "
            f"(follow the OUTPUT_LANGUAGE script rules)."
        )
    pdf_block = _PDF_COVERAGE_RULES if from_pdf else ""
    length_block = _length_guidance(source_len, from_pdf=from_pdf) if source_len > 0 else ""
    return (
        "You are an expert school teacher. Simplify the chapter for students using clear structure, "
        "realistic examples, and language that matches OUTPUT_LANGUAGE exactly.\n"
        f"{lang}{focus}\n"
        + _GROUNDING_RULES
        + pdf_block
        + (f"\n{length_block}\n" if length_block else "")
        + "\nInclude at least two visual_briefs: one animation_storyboard and one mermaid when possible.\n"
        "For mermaid_diagram, use classDef to color and style nodes for clarity. "
        "Use subgraphs to group related nodes when helpful.\n"
        + _JSON_CONTRACT
    )


_MERMAID_HEADER = re.compile(
    r"^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|"
    r"gantt|pie|journey|mindmap|timeline|quadrantChart|block-beta|packet-beta)\b",
    re.IGNORECASE | re.MULTILINE,
)


def _strip_mermaid_fences(raw: str | None) -> str | None:
    """Remove Mermaid code fences and normalize blank inputs to None."""
    if not raw or not str(raw).strip():
        return None
    s = str(raw).strip()
    s = re.sub(r"^```mermaid\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^```\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s.strip() or None


def _sanitize_mermaid_diagram(raw: str | None) -> str | None:
    """Drop preamble lines; ensure a Mermaid diagram keyword starts the chart (v11 is strict)."""
    md = _strip_mermaid_fences(raw)
    if not md:
        return None
    if "\\n" in md and "\n" not in md:
        md = md.replace("\\n", "\n")
    lines = md.splitlines()
    start = 0
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        if _MERMAID_HEADER.match(line):
            start = i
            break
    else:
        body = "\n".join(ln.strip() for ln in lines if ln.strip())
        if not body:
            return None
        return f"flowchart TD\n{body}"
    diagram = "\n".join(lines[start:]).strip()
    if not diagram:
        return None
    # Smart quotes / unicode dashes often break Mermaid 11 parsers in labels.
    diagram = (
        diagram.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u200b", "")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )
    diagram = _enhance_mermaid_vibrancy(diagram)
    return diagram


_MERMAID_CLASSDEFS = (
    "classDef main fill:#fff3cd,stroke:#8a6d00,stroke-width:2.5px,color:#1f1f1f;",
    "classDef accent1 fill:#d1f7ff,stroke:#0077a6,stroke-width:2.5px,color:#1f1f1f;",
    "classDef accent2 fill:#e7dbff,stroke:#6f42c1,stroke-width:2.5px,color:#1f1f1f;",
    "classDef accent3 fill:#d9fbe2,stroke:#198754,stroke-width:2.5px,color:#1f1f1f;",
    "classDef accent4 fill:#ffd6e7,stroke:#c2185b,stroke-width:2.5px,color:#1f1f1f;",
    "classDef accent5 fill:#ffe8c2,stroke:#d97706,stroke-width:2.5px,color:#1f1f1f;",
)


def _enhance_mermaid_vibrancy(diagram: str) -> str:
    """Add colorful Mermaid class definitions and assignments when missing."""
    lines = [line for line in diagram.splitlines() if line.strip()]
    if not lines:
        return diagram
    classdef_present = {
        re.match(r"^classDef\s+([A-Za-z0-9_]+)\b", line).group(1)
        for line in lines
        if re.match(r"^classDef\s+([A-Za-z0-9_]+)\b", line)
    }
    if not classdef_present:
        lines.extend(_MERMAID_CLASSDEFS)
        classdef_present = {"main", "accent1", "accent2", "accent3", "accent4", "accent5"}

    node_pattern = re.compile(r"^\s*([A-Za-z0-9_]+)\s*(?:\[|\(|\{|<)")
    class_assignments: list[str] = []
    accent_cycle = ["accent1", "accent2", "accent3", "accent4", "accent5"]
    accent_idx = 0

    for line in lines:
        if line.startswith("classDef ") or line.startswith("class "):
            continue
        m = node_pattern.match(line)
        if not m:
            continue
        node_id = m.group(1)
        label = line.lower()
        if any(word in label for word in ["main", "overview", "summary", "foundation", "core", "central"]):
            class_assignments.append(f"class {node_id} main;")
            continue
        if any(word in label for word in ["process", "step", "flow", "sequence", "stage", "timeline"]):
            cls = accent_cycle[accent_idx % len(accent_cycle)]
            accent_idx += 1
            class_assignments.append(f"class {node_id} {cls};")
            continue
        if any(word in label for word in ["asexual", "binary fission", "budding", "fragmentation", "vegetative"]):
            class_assignments.append(f"class {node_id} accent3;")
            continue
        if any(word in label for word in ["sexual", "gamete", "zygote", "fertilisation", "fertilization"]):
            class_assignments.append(f"class {node_id} accent4;")
            continue
        if any(word in label for word in ["example", "illustration", "analogy", "real-life", "life", "use case"]):
            class_assignments.append(f"class {node_id} accent5;")
            continue
        cls = accent_cycle[accent_idx % len(accent_cycle)]
        accent_idx += 1
        class_assignments.append(f"class {node_id} {cls};")

    if class_assignments:
        lines.extend(class_assignments)

    for cls, classdef in zip(["main", "accent1", "accent2", "accent3", "accent4", "accent5"], _MERMAID_CLASSDEFS):
        if cls not in classdef_present and any(f" {cls}" in assignment for assignment in class_assignments):
            lines.append(classdef)

    return "\n".join(lines)


def _strip_response_json_fences(raw: str) -> str:
    """Strip common JSON fences from model output."""
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def _extract_json_object(raw: str) -> dict | None:
    """Parse JSON from model output; tolerate leading/trailing prose and fenced blocks."""
    s = _strip_response_json_fences(raw)
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    start = s.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(s[start : i + 1])
                    return obj if isinstance(obj, dict) else None
                except json.JSONDecodeError:
                    return None
    return None


_ALLOWED_KIND = frozenset(
    {"diagram", "analogy_illustration", "timeline", "graph_concept", "animation_idea", "other"}
)
_ALLOWED_FORMAT = frozenset({"mermaid", "animation_storyboard", "svg_or_image"})


def _normalize_simple_examples(items: object) -> list[str]:
    """Coerce the examples field into a clean list of short strings."""
    if not isinstance(items, list):
        return []
    out = [str(x).strip() for x in items if x is not None and str(x).strip()]
    return out[:24] if out else []


def _normalize_visual_briefs(items: object) -> list[dict]:
    """Validate and trim visual brief objects to the supported schema."""
    if not isinstance(items, list):
        return []
    out: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "Visual")).strip() or "Visual"
        desc = str(item.get("description", "")).strip() or "See chapter."
        k = str(item.get("kind", "other")).lower()
        if k not in _ALLOWED_KIND:
            k = "other"
        f = str(item.get("suggested_format", "svg_or_image")).lower()
        if f not in _ALLOWED_FORMAT:
            f = "svg_or_image"
        entry: dict = {"title": title[:400], "description": desc[:4000], "kind": k, "suggested_format": f}
        src = item.get("src")
        if isinstance(src, str) and src.strip():
            entry["src"] = src.strip()
        md = item.get("mermaid_diagram")
        if isinstance(md, str) and md.strip():
            entry["mermaid_diagram"] = md.strip()
        out.append(entry)
    return out


def _visual_brief_defaults() -> list[dict]:
    """Return fallback visual briefs when the model output is incomplete."""
    return [
        {
            "title": "Main concept diagram",
            "description": "A diagram linking the central ideas from the chapter for quick review.",
            "kind": "diagram",
            "suggested_format": "mermaid",
        },
        {
            "title": "Process or storyboard",
            "description": "A short animation-style sequence showing how the main process unfolds step by step.",
            "kind": "animation_idea",
            "suggested_format": "animation_storyboard",
        },
        {
            "title": "Relatable everyday illustration",
            "description": "A vivid classroom-friendly image that connects the chapter idea to a familiar real-world scene.",
            "kind": "analogy_illustration",
            "suggested_format": "svg_or_image",
        },
    ]


def _brief_image_prompt(brief: dict, topic_hint: str | None, output_language: OutputLanguage) -> str:
    """Convert one visual brief into an image-generation prompt."""
    title = str(brief.get("title", "Visual")).strip() or "Visual"
    desc = str(brief.get("description", "See chapter.")).strip() or "See chapter."
    topic = f"Lesson topic hint: {topic_hint}. " if topic_hint else ""
    lang_note = ""
    if output_language != "english":
        lang_note = (
            f"The lesson is in {language_display_name(output_language)}, "
            "but the image should use no readable text. "
        )
    return (
        f"Create one vibrant educational illustration for a school lesson. {topic}{lang_note}"
        f"Subtopic title: {title}. Subtopic description: {desc}. "
        "Use a clean composition, bright classroom-friendly colors, clear focal subject, subtle depth, no text, no labels, no watermark, no logo, and no clutter."
    )


def _brief_style_suffix(brief: dict) -> str:
    """Map one visual brief to a style suffix for the image model."""
    kind = str(brief.get("kind", "other")).lower()
    suggested_format = str(brief.get("suggested_format", "svg_or_image")).lower()
    if suggested_format == "mermaid":
        return "educational infographic poster, vivid flat vector style, no text, crisp edges"
    if kind == "animation_idea":
        return "dynamic storyboard frame, motion hints, colorful classroom illustration, no text"
    if kind == "timeline":
        return "timeline-style educational illustration with flowing panels and icons, no text"
    if kind == "graph_concept":
        return "clean graph-inspired educational poster with bold color blocks and icons, no text"
    if kind == "analogy_illustration":
        return "relatable everyday analogy illustration, vivid and symbolic, no text"
    return "bright school-friendly educational illustration, balanced composition, no text"


async def _generate_brief_image(
    settings: Settings,
    *,
    brief: dict,
    topic_hint: str | None,
    output_language: OutputLanguage,
    llm_provider: str | None,
) -> tuple[str, str] | None:
    """Generate one visual brief image with the configured image backend."""
    prompt = _brief_image_prompt(brief, topic_hint, output_language)
    style_suffix = _brief_style_suffix(brief)
    generator = illustration_openai.generate_illustration_png_b64
    if llm_provider != "openai":
        generator = illustration_opensource.generate_illustration_png_b64
    try:
        return await generator(settings, prompt=prompt, style_suffix=style_suffix)
    except Exception:
        return None


async def _attach_generated_visual_assets(
    parsed: ExplainResponse,
    *,
    output_language: OutputLanguage,
    topic_hint: str | None,
    llm_provider: str | None,
) -> ExplainResponse:
    """Populate missing visual briefs with generated image assets when possible."""
    briefs = [b.model_copy() for b in parsed.visual_briefs]
    if len(briefs) < 3:
        needed = 3 - len(briefs)
        briefs.extend(VisualAssetBrief.model_validate(item) for item in _visual_brief_defaults()[:needed])

    settings = get_settings()
    tasks: list[tuple[int, asyncio.Task]] = []
    for idx, brief in enumerate(briefs):
        if brief.src:
            continue
        if brief.kind == "diagram" and brief.suggested_format == "mermaid":
            continue
        tasks.append(
            (
                idx,
                asyncio.create_task(
                    _generate_brief_image(
                        settings,
                        brief=brief.model_dump(),
                        topic_hint=topic_hint,
                        output_language=output_language,
                        llm_provider=llm_provider,
                    )
                ),
            )
        )

    if tasks:
        results = await asyncio.gather(*(task for _, task in tasks), return_exceptions=True)
        for (idx, _task), result in zip(tasks, results):
            if isinstance(result, tuple) and result[0]:
                briefs[idx] = briefs[idx].model_copy(update={"src": f"data:{result[1]};base64,{result[0]}"})

    return parsed.model_copy(update={"visual_briefs": briefs})


def _coerce_explain_dict(data: dict) -> dict:
    """Map common wrong shapes (e.g. title+text only) toward the ExplainResponse schema."""
    d = dict(data)
    em = d.get("explanation_markdown")
    if not isinstance(em, str) or not em.strip():
        pieces: list[str] = []
        if isinstance(d.get("title"), str) and d["title"].strip():
            pieces.append(f"## {d['title'].strip()}")
        for key in ("text", "content", "body", "abstract", "summary", "description"):
            val = d.get(key)
            if isinstance(val, str) and val.strip():
                pieces.append(val.strip())
                break
        if pieces:
            d["explanation_markdown"] = "\n\n".join(pieces)
    d["simple_examples"] = _normalize_simple_examples(d.get("simple_examples"))
    d["visual_briefs"] = _normalize_visual_briefs(d.get("visual_briefs"))

    main_mermaid = d.get("mermaid_diagram")
    for b in d["visual_briefs"]:
        if (
            b.get("kind") == "diagram"
            and b.get("suggested_format") == "mermaid"
            and not b.get("mermaid_diagram")
            and isinstance(main_mermaid, str)
            and main_mermaid.strip()
        ):
            b["mermaid_diagram"] = main_mermaid.strip()
    topics = d.get("suggested_followup_topics")
    if not isinstance(topics, list):
        d["suggested_followup_topics"] = []
    else:
        d["suggested_followup_topics"] = [str(t).strip() for t in topics if str(t).strip()][:20]
    if "video_lesson_prompt" not in d:
        d["video_lesson_prompt"] = None
    if "mermaid_diagram" not in d:
        d["mermaid_diagram"] = None
    if "diagram_caption" not in d:
        d["diagram_caption"] = None
    return d


def _parse_explain_json(raw: str) -> ExplainResponse:
    """Parse the LLM response into the explanation schema."""
    data = _extract_json_object(raw)
    if not data:
        raise ValueError(
            "The explanation model returned an invalid response. Please try again."
        )
    data = _coerce_explain_dict(data)
    md = data.get("mermaid_diagram")
    if isinstance(md, str):
        data["mermaid_diagram"] = _sanitize_mermaid_diagram(md)
    try:
        return ExplainResponse.model_validate(data)
    except ValidationError as exc:
        raise ValueError(
            "The explanation model returned an incomplete lesson. Please try again."
        ) from exc


def _explain_max_tokens(chapter_len: int) -> int:
    """Long PDF context needs a larger JSON lesson in the reply."""
    if chapter_len > 45_000:
        return 16_384
    if chapter_len > 15_000:
        return 8192
    if chapter_len > 6000:
        return 6144
    return 4096


def _finalize(parsed: ExplainResponse, output_language: OutputLanguage) -> ExplainResponse:
    """Attach the final output language used by the explanation pipeline."""
    return parsed.model_copy(update={"output_language_used": output_language})


async def explain_from_pdf_bytes(
    pdf_bytes: bytes,
    *,
    output_language: OutputLanguage,
    topic_hint: str | None,
    llm_provider: str | None,
) -> ExplainResponse:
    """Extract PDF text and generate the explanation payload from it."""
    try:
        ext = await anyio.to_thread.run_sync(
            functools.partial(extract_pdf_to_text, pdf_bytes)
        )
    except ValueError as exc:
        if "No text could be extracted" not in str(exc):
            raise
        return await _explain_pdf_via_vision(
            pdf_bytes,
            output_language=output_language,
            topic_hint=topic_hint,
            llm_provider=llm_provider,
        )

    prefix = (
        "[Source: PDF extraction — content from **all extracted pages** is included below (each page starts with "
        "=== Page N ===). Tables appear in [Table …] blocks. "
        "Base your lesson on the **entire** excerpt, not only the opening lines.]\n\n"
    )
    out = await explain_from_text(
        prefix + ext.chapter_text,
        output_language=output_language,
        topic_hint=topic_hint,
        llm_provider=llm_provider,
        grounding_source=ext.chapter_text,
        from_pdf=True,
    )
    return out.model_copy(
        update={
            "pdf_extraction_notes": ext.notes,
            "source_text_used_for_context": ext.chapter_text,
        }
    )


def pdf_pages_to_image_bytes(
    pdf_bytes: bytes,
    *,
    max_pages: int = 20,
    scale: float = 2.0,
) -> list[tuple[str, bytes]]:
    """Render PDF pages to PNG bytes for vision-based explanation."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if len(doc) == 0:
            return []
        effective = min(len(doc), max_pages)
        mat = fitz.Matrix(scale, scale)
        pairs: list[tuple[str, bytes]] = []
        for i in range(effective):
            pix = doc[i].get_pixmap(matrix=mat, alpha=False)
            pairs.append((f"page_{i + 1}.png", pix.tobytes("png")))
        return pairs
    finally:
        doc.close()


async def _explain_pdf_via_vision(
    pdf_bytes: bytes,
    *,
    output_language: OutputLanguage,
    topic_hint: str | None,
    llm_provider: str | None,
) -> ExplainResponse:
    """Fallback for scanned/image-only PDFs: render pages and use the vision model."""
    pairs = await anyio.to_thread.run_sync(
        functools.partial(pdf_pages_to_image_bytes, pdf_bytes)
    )
    if not pairs:
        raise ValueError(
            "No text could be extracted from this PDF. "
            "Use a PDF with selectable text, or paste the content as plain text."
        )
    out = await explain_from_image_bytes(
        pairs,
        output_language=output_language,
        topic_hint=topic_hint,
        llm_provider=llm_provider,
    )
    notes = (
        f"PDF: {len(pairs)} page(s) read with the vision model "
        "(no selectable text was found in the file)."
    )
    return out.model_copy(
        update={
            "pdf_extraction_notes": notes,
            "source_text_used_for_context": out.explanation_markdown,
        }
    )


async def explain_from_text(
    chapter_text: str,
    *,
    output_language: OutputLanguage,
    topic_hint: str | None,
    llm_provider: str | None = None,
    grounding_source: str | None = None,
    from_pdf: bool = False,
) -> ExplainResponse:
    """Generate the explanation payload directly from plain chapter text."""
    plain = chapter_text.strip()
    is_pdf = from_pdf or _looks_like_pdf_extraction(plain)
    grounding = grounding_source_text(plain, override=grounding_source)
    source_len = len(grounding)

    if is_pdf and not plain.startswith("[Source: PDF"):
        llm_input = (
            "[Source: PDF extraction — content from **all extracted pages** is included below "
            "(each page starts with === Page N ===). Tables appear in [Table …] blocks. "
            "Base your lesson on the **entire** excerpt, not only the opening lines.]\n\n"
            + plain
        )
    else:
        llm_input = plain

    provider = get_llm_provider(vision=False, provider=llm_provider)
    max_tokens = _explain_max_tokens(source_len)
    retryable = ("too short", "incomplete", "does not appear to be based")
    min_total = minimum_explanation_chars(source_len)
    min_markdown = minimum_markdown_chars(source_len)
    best: ExplainResponse | None = None
    best_len = 0

    for attempt in range(3):
        retry_note = ""
        if attempt > 0:
            retry_note = (
                "\n\nRETRY — Your previous answer was too brief or incomplete. "
                f"Write a longer, fuller lesson covering every major section. "
                f"Total learner-facing text should be at least ~{min_total} characters "
                f"(explanation_markdown at least ~{min_markdown}).\n"
            )

        body = (
            _user_language_block(output_language)
            + _GROUNDING_RULES
            + (_PDF_COVERAGE_RULES if is_pdf else "")
            + "\nChapter content (source material; may be any language — translate and explain fully in OUTPUT_LANGUAGE):\n\n"
            + llm_input
            + retry_note
            + "\n\n"
            + _user_language_block(output_language, closing=True)
        )
        messages: list[Message] = [
            {
                "role": "system",
                "content": _system_prompt(
                    output_language,
                    topic_hint,
                    from_pdf=is_pdf,
                    source_len=source_len,
                ),
            },
            {"role": "user", "content": body},
        ]
        raw = await provider.complete_chat(
            messages,
            max_tokens=max_tokens,
            temperature=0.35,
        )
        parsed = _parse_explain_json(raw)
        content_len = learner_facing_char_count(parsed)
        if content_len > best_len:
            best = parsed
            best_len = content_len
        try:
            validate_explanation_grounding(
                source_text=grounding,
                parsed=parsed,
                require_grounding=True,
                output_language=output_language,
            )
        except ValueError as exc:
            if attempt < 2 and any(token in str(exc).casefold() for token in retryable):
                continue
            if best and best_len >= int(min_total * 0.7):
                return _finalize(best, output_language)
            raise
        return _finalize(parsed, output_language)

    raise ValueError("The explanation model could not produce a complete lesson. Please try again.")


def guess_image_mime(header: bytes) -> str:
    """Guess an image MIME type from its leading bytes."""
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return "image/gif"
    if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"


async def explain_from_image_bytes(
    files: list[tuple[str, bytes]],
    *,
    output_language: OutputLanguage,
    topic_hint: str | None,
    llm_provider: str | None = None,
) -> ExplainResponse:
    """Read one or more images and generate the lesson explanation from them."""
    intro = (
        _user_language_block(output_language)
        + _GROUNDING_RULES
        + "These images are textbook chapter pages. Read them, then explain simply for students using ONLY what appears in the images. "
        + "All learner-facing strings in your JSON must follow OUTPUT_LANGUAGE. "
        + (
            f"When topic_hint is provided, emphasize {topic_hint} within the image content only. "
            if topic_hint
            else ""
        )
        + _JSON_CONTRACT
    )
    closing = _user_language_block(output_language, closing=True)

    content: list[TextPart | ImageUrlPart] = [{"type": "text", "text": intro}]

    for _filename, data in files:
        if not data:
            continue
        mime = guess_image_mime(data[:12])
        if mime == "application/octet-stream":
            mime = "image/png"
        b64 = base64.standard_b64encode(data).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}"},
            }
        )

    content.append({"type": "text", "text": closing})

    messages: list[Message] = [
        {
            "role": "system",
            "content": _system_prompt(
                output_language,
                topic_hint,
                from_pdf=True,
                source_len=0,
            ),
        },
        {"role": "user", "content": content},
    ]

    provider = get_llm_provider(vision=True, provider=llm_provider)
    raw = await provider.complete_chat(messages, max_tokens=8192, temperature=0.35)
    parsed = _parse_explain_json(raw)
    validate_explanation_grounding(
        source_text="",
        parsed=parsed,
        require_grounding=False,
        output_language=output_language,
    )
    return _finalize(parsed, output_language)
