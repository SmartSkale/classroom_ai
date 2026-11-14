import json
import random
import re

from pydantic import ValidationError

from app.schemas.language import OutputLanguage
from app.schemas.quiz import Difficulty, QuizGenerateResponse, QuizQuestion
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import Message

MAX_ATTEMPTS = 4
CONTEXT_LIMIT = 26000
LEVEL_ORDER: tuple[Difficulty, ...] = ("easy", "medium", "hard")

_DIFFICULTY_GUIDE: dict[Difficulty, str] = {
    "easy": (
        "EASY (recall). Ask for a definition, a named part, or a fact stated directly in the material. "
        "Wrong options are clearly different from the right answer."
    ),
    "medium": (
        "MEDIUM (understanding). Ask for the function, cause, order of steps, or the difference between two ideas. "
        "Wrong options are plausible mix-ups between related concepts."
    ),
    "hard": (
        "HARD (application and reasoning). Give a short scenario or a changed condition and ask what follows, "
        "using the material. Wrong options are close misconceptions that need careful reasoning to rule out."
    ),
}

# Patterns that make a question unfit for an exam paper.
_SOURCE_REFERENCE = re.compile(
    r"\b(according to|based only on|as (described|stated|mentioned) in|in the (lesson|passage|text|chapter|section)"
    r"|the (lesson|passage|chapter|text|section) (says|states|mentions|includes|describes))\b",
    re.IGNORECASE,
)
_META_OPTION = re.compile(
    r"(all of the above|none of the above|both [a-d] and [a-d]|\boption\s*\d|^[a-d]\)?$|\bnone of these\b)",
    re.IGNORECASE,
)
_NUMBER_PREFIX = re.compile(r"^\s*\[?\d{1,2}[\].)]\s*")


def _lang_rule(lang: OutputLanguage) -> str:
    if lang == "english":
        return "All learner-facing text must be in English."
    if lang == "hindi":
        return "All learner-facing text must be in Hindi (Devanagari script)."
    return "All learner-facing text must be in Roman Hindi (Latin letters only, no Devanagari)."


def _prompt(
    *,
    topic: str,
    difficulty: Difficulty,
    question_count: int,
    output_language: OutputLanguage,
    context_text: str | None,
) -> str:
    ctx = (context_text or "").strip()[:CONTEXT_LIMIT]
    source_rule = (
        "The material below is the only source of facts. Every question must test something stated in it."
        if ctx
        else "No material was supplied, so write standard textbook questions about the topic."
    )
    return (
        "You are a senior exam paper setter. Write multiple-choice questions (MCQs) in the style of a "
        "school or competitive exam.\n"
        f"Topic (for orientation only, never quote it): {topic}\n"
        f"Difficulty: {_DIFFICULTY_GUIDE[difficulty]}\n"
        f"Number of questions: {question_count}, all at this difficulty.\n"
        f"{_lang_rule(output_language)}\n"
        f"{source_rule}\n\n"
        "HOW EXAM MCQs ARE WRITTEN\n"
        "- The stem is one complete question about ONE concept, fact, process, cause, or difference, "
        "for example: \"Which pigment absorbs light energy in a chloroplast?\" It must make sense read alone.\n"
        "- Never refer to the source in a stem or option: no \"according to the lesson\", \"the passage\", "
        "\"the text\", \"this chapter\". Never put the chapter, section, or topic title in a stem or option.\n"
        "- Exactly four options with exactly one correct answer. Options are short (usually 2 to 12 words), "
        "parallel in grammar, and each one is a distinct answer. An option is never a copied sentence from the material.\n"
        "- Wrong options (distractors) are plausible: a common misconception, a mix-up with a related term, or a "
        "true fact that answers a different question. None is absurd.\n"
        "- Never use \"all of the above\", \"none of the above\", \"both A and B\", or \"Option 1\".\n"
        "- Do not make the correct answer the longest option every time. Vary where the answer sits.\n"
        "- Cover different parts of the material. No two questions test the same fact, and no option is repeated "
        "across questions.\n"
        "- The stem must not give the answer away.\n\n"
        "OUTPUT\n"
        "Return JSON only, no markdown, with keys: topic, output_language_used, questions.\n"
        "Each question object has: id (\"q1\", \"q2\", ...), question, options (exactly 4 strings), "
        "correct_option_index (0 to 3), correct_explanation (1 to 2 sentences on why the answer is right), "
        "wrong_explanation (1 to 2 sentences on what the wrong options get wrong), and option_explanations "
        "(4 short reasons, one per option, in the same order as options).\n"
        + (f"\nMaterial:\n{ctx}\n" if ctx else "")
    )


def _clean(text: str) -> str:
    return " ".join(text.split()).strip()


def _norm(text: str) -> str:
    return re.sub(r"[^\w]+", " ", text.lower()).strip()


def _mentions_topic(text: str, topic: str) -> bool:
    title = _norm(topic)
    # Short topic labels are too generic to match reliably; only long titles are treated as the chapter name.
    return len(title) >= 8 and title in _norm(text)


def _usable(q: QuizQuestion, topic: str) -> bool:
    """True when the question meets exam-paper rules: self-contained, four distinct options, no source references."""
    stem = _clean(q.question)
    if len(stem) < 12 or "«" in stem or "»" in stem:
        return False
    if _SOURCE_REFERENCE.search(stem) or _mentions_topic(stem, topic):
        return False
    options = [_clean(o) for o in q.options]
    if len(options) != 4 or not all(2 <= len(o) <= 180 for o in options):
        return False
    if len({_norm(o) for o in options}) != 4:
        return False
    for o in options:
        if _norm(o) == _norm(stem) or _META_OPTION.search(o) or _mentions_topic(o, topic):
            return False
        if _SOURCE_REFERENCE.search(o):
            return False
    return 0 <= q.correct_option_index < 4


def _shuffled(q: QuizQuestion, rng: random.Random) -> QuizQuestion:
    """Move the correct answer to a random position so it is not always the same letter."""
    order = list(range(4))
    rng.shuffle(order)
    options = [_clean(q.options[i]) for i in order]
    explanations = q.option_explanations
    new_explanations = None
    if explanations and len(explanations) >= 4:
        new_explanations = [explanations[i] for i in order]
    return q.model_copy(
        update={
            "question": _clean(_NUMBER_PREFIX.sub("", q.question)),
            "options": options,
            "correct_option_index": order.index(q.correct_option_index),
            "option_explanations": new_explanations,
        }
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


def _parse_questions(raw: str, topic: str, difficulty: Difficulty) -> list[QuizQuestion]:
    data = _extract_json_obj(raw) or {}
    raw_questions = data.get("questions")
    if not isinstance(raw_questions, list):
        return []
    out: list[QuizQuestion] = []
    for item in raw_questions:
        if not isinstance(item, dict):
            continue
        try:
            q = QuizQuestion.model_validate(
                {
                    "id": str(item.get("id") or "q"),
                    "difficulty": difficulty,
                    "question": str(item.get("question") or ""),
                    "options": [str(o) for o in (item.get("options") or [])],
                    "correct_option_index": int(item.get("correct_option_index", -1)),
                    "correct_explanation": str(item.get("correct_explanation") or "").strip(),
                    "wrong_explanation": str(item.get("wrong_explanation") or "").strip(),
                    "option_explanations": [str(x) for x in (item.get("option_explanations") or [])] or None,
                }
            )
        except (ValidationError, TypeError, ValueError):
            continue
        if _usable(q, topic):
            out.append(q)
    return out


async def _generate_level(
    *,
    provider,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage,
    difficulty: Difficulty,
    count: int,
    seen_stems: set[str],
    seen_answers: set[str],
) -> list[QuizQuestion]:
    """Generate `count` usable questions at one difficulty, skipping anything already seen in other levels."""
    ctx = (context_text or "").strip()
    temperature = 0.35 if ctx else 0.5
    max_tokens = 9000 if ctx else 6000
    collected: list[QuizQuestion] = []

    for _ in range(MAX_ATTEMPTS):
        remaining = count - len(collected)
        if remaining <= 0:
            break

        avoid = ""
        if seen_stems:
            avoid = "\nDo NOT repeat these questions:\n- " + "\n- ".join(sorted(seen_stems)[:40])
        messages: list[Message] = [
            {
                "role": "system",
                "content": "You write exam-quality multiple-choice questions and output strict JSON only.",
            },
            {
                "role": "user",
                "content": _prompt(
                    topic=topic,
                    difficulty=difficulty,
                    question_count=remaining,
                    output_language=output_language,
                    context_text=context_text,
                )
                + avoid,
            },
        ]
        raw = await provider.complete_chat(messages, max_tokens=max_tokens, temperature=temperature)

        for q in _parse_questions(raw, topic, difficulty):
            stem_key = _norm(q.question)
            answer_key = _norm(q.options[q.correct_option_index])
            if stem_key in seen_stems or answer_key in seen_answers:
                continue
            seen_stems.add(stem_key)
            seen_answers.add(answer_key)
            collected.append(q)
            if len(collected) >= count:
                break
    return collected


async def generate_quiz(
    *,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage,
    easy_count: int,
    medium_count: int,
    hard_count: int,
    llm_provider: str,
) -> QuizGenerateResponse:
    provider = get_llm_provider(vision=False, provider=llm_provider)
    requested = {"easy": easy_count, "medium": medium_count, "hard": hard_count}

    seen_stems: set[str] = set()
    seen_answers: set[str] = set()
    collected: list[QuizQuestion] = []
    for level in LEVEL_ORDER:
        if requested[level] <= 0:
            continue
        collected += await _generate_level(
            provider=provider,
            topic=topic,
            context_text=context_text,
            output_language=output_language,
            difficulty=level,
            count=requested[level],
            seen_stems=seen_stems,
            seen_answers=seen_answers,
        )

    if not collected:
        raise ValueError(
            "The model did not return usable exam questions. Make sure the model is running, then try again."
        )

    rng = random.Random()
    final = [_shuffled(q, rng).model_copy(update={"id": f"q{i + 1}"}) for i, q in enumerate(collected)]
    return QuizGenerateResponse(
        topic=topic,
        output_language_used=output_language,
        questions=final,
    )
