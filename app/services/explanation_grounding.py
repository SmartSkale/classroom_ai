"""
Validate that generated explanations are grounded in the provided source text.
"""

from __future__ import annotations

import re
import unicodedata

from app.schemas.explain import ExplainResponse
from app.schemas.language import OutputLanguage, looks_english_learner_text

_PDF_SOURCE_PREFIX_RE = re.compile(
    r"^\[Source: PDF extraction[^\]]*\]\s*\n+",
    re.IGNORECASE | re.DOTALL,
)
_WORD_RE = re.compile(r"[\w\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F]+", re.UNICODE)

_STOPWORDS = frozenset(
    """
    a an the and or but if in on at to for of is are was were be been being
    with from by as that this these those it its they them their we you your
    he she his her not no yes can will would could should about into over
    also than then when where which who what how why very more most some any
    each other such only just even still already however therefore because
    while during before after between through under above below again further
    here there all both few own same so too up down out off very
    """.split()
)

_GENERIC_PHRASES = (
    "state the main idea from the chapter in one sentence",
    "give a concrete example that uses one quantity or object from the reading",
    "connect one vocabulary term to the rest of the lesson",
    "diagram not available",
    "the model returned non-json text",
    "see chapter.",
)

_MIN_SOURCE_CHARS_FOR_OVERLAP = 180
_MIN_EXPLANATION_CHARS = 120
_MIN_EXPLANATION_CHARS_LONG_SOURCE = 200
_LONG_SOURCE_CHARS = 800
_MIN_SHARED_TERMS = 5
_MIN_OVERLAP_RATIO = 0.10
_MIN_SIMPLE_EXAMPLES = 2
_MIN_VISUAL_BRIEFS = 1


def minimum_explanation_chars(source_len: int) -> int:
    """Target total learner-facing content length for the given source size."""
    if source_len < 300:
        return max(80, min(180, source_len))
    if source_len < 1200:
        return max(180, source_len // 5)
    if source_len < 5000:
        return max(350, source_len // 8)
    if source_len < 20_000:
        return max(600, source_len // 12)
    return max(1200, min(3500, source_len // 15))


def minimum_markdown_chars(source_len: int) -> int:
    """Minimum length for explanation_markdown alone (lower than total lesson)."""
    total = minimum_explanation_chars(source_len)
    return max(120, min(total, total // 2))


def grounding_source_text(chapter_text: str, *, override: str | None = None) -> str:
    """Return the plain source text used for overlap checks."""
    if override is not None:
        return override.strip()
    return _PDF_SOURCE_PREFIX_RE.sub("", chapter_text.strip())


def _normalize_token(token: str) -> str:
    folded = unicodedata.normalize("NFKC", token).casefold()
    return folded.strip("_-")


def significant_terms(text: str, *, limit: int = 150) -> set[str]:
    """Language-agnostic content terms (length >= 4, not stopwords)."""
    seen: set[str] = set()
    ordered: list[str] = []
    for match in _WORD_RE.finditer(text):
        raw = match.group(0)
        if len(raw) < 4:
            continue
        token = _normalize_token(raw)
        if len(token) < 4 or token in _STOPWORDS or token.isdigit():
            continue
        if token not in seen:
            seen.add(token)
            ordered.append(token)
        if len(ordered) >= limit:
            break
    return set(ordered)


def grounding_overlap_ratio(source_text: str, learner_text: str) -> float:
    """Share of significant source terms that also appear in the learner-facing text."""
    source_terms = significant_terms(source_text)
    if not source_terms:
        return 1.0
    learner_terms = significant_terms(learner_text)
    if not learner_terms:
        return 0.0
    shared = source_terms & learner_terms
    return len(shared) / len(source_terms)


def shared_term_count(source_text: str, learner_text: str) -> int:
    return len(significant_terms(source_text) & significant_terms(learner_text))


def _learner_facing_text(parsed: ExplainResponse) -> str:
    parts = [parsed.explanation_markdown]
    parts.extend(parsed.simple_examples)
    for brief in parsed.visual_briefs:
        parts.append(brief.title)
        parts.append(brief.description)
    if parsed.diagram_caption:
        parts.append(parsed.diagram_caption)
    return "\n".join(parts)


def learner_facing_char_count(parsed: ExplainResponse) -> int:
    """Total characters in all student-visible fields."""
    return len(_learner_facing_text(parsed))


def _contains_generic_filler(parsed: ExplainResponse) -> bool:
    blob = _learner_facing_text(parsed).casefold()
    return any(phrase in blob for phrase in _GENERIC_PHRASES)


def _source_looks_english(source_text: str) -> bool:
    """Heuristic: is the uploaded chapter mostly English/Latin script?"""
    sample = source_text[:8000]
    return looks_english_learner_text(sample)


def should_skip_term_overlap(
    source_text: str,
    output_language: OutputLanguage,
) -> bool:
    """
    Skip lexical overlap when the lesson is translated across languages.

    English PDF → Hindi/Roman Hindi/etc. will not share tokens with the source,
    but can still be a faithful translation.
    """
    source = source_text.strip()
    if not source:
        return True
    source_english = _source_looks_english(source)
    if output_language != "english" and source_english:
        return True
    if output_language == "english" and not source_english:
        return True
    return False


def validate_explanation_grounding(
    *,
    source_text: str,
    parsed: ExplainResponse,
    require_grounding: bool = True,
    output_language: OutputLanguage = "english",
) -> None:
    """
    Raise ValueError when the explanation looks ungrounded, incomplete, or generic.
    """
    source = source_text.strip()
    learner_text = _learner_facing_text(parsed).strip()
    explanation = parsed.explanation_markdown.strip()

    if not explanation:
        raise ValueError(
            "The explanation model did not return lesson content. Please try again."
        )

    if _contains_generic_filler(parsed):
        raise ValueError(
            "The generated explanation looked generic instead of based on your material. "
            "Please try again or paste the chapter as plain text."
        )

    if len(parsed.simple_examples) < _MIN_SIMPLE_EXAMPLES:
        raise ValueError(
            "The generated explanation was incomplete (missing concrete examples). "
            "Please try again."
        )

    if len(parsed.visual_briefs) < _MIN_VISUAL_BRIEFS:
        raise ValueError(
            "The generated explanation was incomplete (missing visual briefs). "
            "Please try again."
        )

    min_total = minimum_explanation_chars(len(source))
    min_markdown = minimum_markdown_chars(len(source))
    # Count the full lesson (markdown + examples + briefs), not markdown alone —
    # the model spreads content across JSON fields and max_tokens.
    if len(learner_text) < min_total and len(explanation) < min_markdown:
        raise ValueError(
            "The generated explanation was too short for the uploaded material. "
            "Please try again."
        )

    if (
        not require_grounding
        or len(source) < _MIN_SOURCE_CHARS_FOR_OVERLAP
        or should_skip_term_overlap(source, output_language)
    ):
        return

    overlap = grounding_overlap_ratio(source, learner_text)
    shared = shared_term_count(source, learner_text)
    if shared < _MIN_SHARED_TERMS or overlap < _MIN_OVERLAP_RATIO:
        raise ValueError(
            "The generated explanation does not appear to be based on your uploaded material. "
            "Upload a PDF with selectable text or paste the chapter content as plain text."
        )
