import json
import logging
import re

from pydantic import ValidationError

from app.schemas.language import (
    OutputLanguage,
    language_option_pad,
    language_script_rule,
    learner_text_wrong_language,
    localization_target_description,
    looks_english_learner_text,
)
from app.schemas.quiz import QuizGenerateResponse, QuizQuestion
from app.services.llm.factory import get_llm_provider
from app.services.llm.types import Message

logger = logging.getLogger(__name__)


def _lang_rule(lang: OutputLanguage) -> str:
    return language_script_rule(lang)


def _option_pad_label(lang: OutputLanguage, n: int) -> str:
    return language_option_pad(lang, n)


def _stem_focus(sentence: str, *, max_len: int = 72) -> str:
    """Short unique fragment so fallback stems do not look identical across questions."""
    s = " ".join(sentence.split())
    if len(s) <= max_len:
        return s
    cut = s[: max_len - 1].rsplit(" ", 1)[0]
    return (cut or s[: max_len - 1]).rstrip(",.;:") + "…"


def _normalize_quotes(text: str) -> str:
    return (
        text.replace("\u00ab", '"')
        .replace("\u00bb", '"')
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )


def _normalize_quiz_question(q: QuizQuestion) -> QuizQuestion:
    oex = q.option_explanations
    norm_oex = [_normalize_quotes(str(x)) for x in oex[:4]] if oex else None
    return q.model_copy(
        update={
            "question": _clean_question_text(q.question),
            "options": [_normalize_quotes(o) for o in q.options],
            "correct_explanation": _normalize_quotes(q.correct_explanation),
            "wrong_explanation": _normalize_quotes(q.wrong_explanation),
            "option_explanations": norm_oex,
        }
    )


def _clean_question_text(question: str) -> str:
    """Remove redundant leading markers; UI adds Q1., Q2., etc."""
    q = _normalize_quotes(question.strip())
    q = re.sub(r"^\[\d+\]\s*", "", q)
    q = re.sub(r"^Q\d+\.\s*", "", q, flags=re.IGNORECASE)
    return q.strip()


def _question_dedupe_key(question: str) -> str:
    """Strip leading [n] markers so near-identical fallback stems collide."""
    q = " ".join(_clean_question_text(question).lower().split())
    return q


def _fallback_stems(
    lang: OutputLanguage,
    n: int,
    topic: str,
    *,
    focus: str | None = None,
) -> str:
    tlab = topic.strip() or "this topic"
    focus_bit = _stem_focus(focus) if focus and focus.strip() else None
    # Avoid embedding raw English lesson quotes inside non-English stems.
    if focus_bit and lang != "english" and looks_english_learner_text(focus_bit):
        focus_bit = None
    if lang == "hindi":
        if focus_bit:
            stems = (
                f"पाठ के अनुसार, \"{focus_bit}\" से सबसे सही कथन कौन-सा है?",
                f"दिए गए पाठ में \"{focus_bit}\" के बारे में कौन-सी पंक्ति सही है?",
                f"केवल पाठ के आधार पर, \"{focus_bit}\" के लिए सही विकल्प चुनें।",
                f"\"{focus_bit}\" के संदर्भ में पाठ क्या कहता है?",
            )
        else:
            stems = (
                f"पाठ के अनुसार, \"{tlab}\" से सबसे अच्छी तरह मेल खाने वाला कथन कौन-सा है?",
                f"दिए गए पाठ में \"{tlab}\" से सीधे संबंधित पंक्ति कौन-सी है?",
                f"केवल पाठ के आधार पर, \"{tlab}\" से सबसे सही विकल्प कौन-सा है?",
                f"पाठ में कई विचार हैं। \"{tlab}\" से सबसे अधिक संबंधित विकल्प कौन-सा है?",
            )
        return stems[(n - 1) % len(stems)]
    if lang == "roman_hindi":
        if focus_bit:
            stems = (
                f"Path ke anusar, \"{focus_bit}\" ke baare mein sabse sahi statement kaunsa hai?",
                f"Diye gaye text mein \"{focus_bit}\" se related sahi line kaunsi hai?",
                f"Keval path ke aadhar par, \"{focus_bit}\" ke liye sahi option chunein.",
                f"\"{focus_bit}\" ke sandarbh mein path kya kehta hai?",
            )
        else:
            stems = (
                f"Path ke anusar, \"{tlab}\" se sabse achhe tarah match karne wala statement kaunsa hai?",
                f"Diye gaye text mein \"{tlab}\" se seedha related line kaunsi hai?",
                f"Keval path ke aadhar par, \"{tlab}\" ke liye sabse sahi option kaunsa hai?",
                f"Path mein kai ideas hain. \"{tlab}\" se sabse adhik related option kaunsa hai?",
            )
        return stems[(n - 1) % len(stems)]
    if focus_bit:
        stems = (
            f"According to the lesson, which statement about \"{focus_bit}\" is correct?",
            f"Which line from the text best matches \"{focus_bit}\"?",
            f"Based only on the passage, which choice is true regarding \"{focus_bit}\"?",
            f"What does the lesson say in connection with \"{focus_bit}\"?",
        )
    else:
        stems = (
            f"According to the lesson, which statement best matches \"{tlab}\"?",
            f"Which line from the text is most directly about \"{tlab}\"?",
            f"Based only on the passage, which choice aligns best with \"{tlab}\"?",
            f"The lesson includes several ideas. Which option is most relevant to \"{tlab}\"?",
        )
    return stems[(n - 1) % len(stems)]


def _fallback_explanations(lang: OutputLanguage, *, correct: bool) -> str:
    if lang == "hindi":
        return (
            "यह पंक्ति पाठ से ली गई है और प्रश्न का सबसे सही उत्तर है।"
            if correct
            else "यह भी पाठ से है, पर इस प्रश्न का सही उत्तर नहीं है।"
        )
    if lang == "roman_hindi":
        return (
            "Yeh line path se li gayi hai aur sawal ka sabse sahi jawab hai."
            if correct
            else "Yeh bhi path se hai, par is sawal ka sahi jawab nahi hai."
        )
    return (
        "Pulled from your lesson text; compare wording to the chapter."
        if correct
        else "Also from the lesson, but not the best answer to this question."
    )


def _prompt(*, topic: str, difficulty: str, question_count: int, output_language: OutputLanguage, context_text: str | None) -> str:
    context = (context_text or "").strip()
    ctx_excerpt = context[:26000]
    if output_language == "english":
        option_grounding = (
            "- ALL FOUR OPTIONS must be taken from the Context: either exact quotes, or a tight paraphrase "
            "of a sentence/phrase that appears there. Do not invent facts that are not supported by the Context.\n"
        )
    else:
        option_grounding = (
            "- ALL FOUR OPTIONS must be factually grounded in the Context, but written entirely in "
            f"the required OUTPUT_LANGUAGE ({output_language}).\n"
            "- Do NOT copy English (or other-language) quotes as options. Translate / adapt each option "
            "into the OUTPUT_LANGUAGE while keeping the same meaning.\n"
            "- Wrong answers must still be real ideas from (or clearly implied by) the Context, but "
            "also fully written in the OUTPUT_LANGUAGE.\n"
        )
    grounded = (
        "\nCONTEXT-GROUNDING (mandatory when Context material is non-empty):\n"
        "- Read the Context material carefully. Every question MUST test understanding of that text.\n"
        + option_grounding
        + "- WRONG answers must still be real statements from (or clearly implied by) the Context, but they must "
        "NOT correctly answer the question (e.g. true facts about a different sub-point, or a misapplied formula).\n"
        "- In option_explanations, briefly cite which part of the Context each option relates to "
        "(write the explanation in OUTPUT_LANGUAGE).\n"
        "- If the Context is too short to build four grounded options, say so by returning fewer questions "
        "only if unavoidable; prefer distinct ideas from the Context.\n"
    )
    base = (
        "You are an expert teacher. Generate high-quality MCQ quiz questions.\n"
        f"Topic label (for orientation only; questions must follow the Context): {topic}\n"
        f"Difficulty: {difficulty}\n"
        f"Question count: {question_count}\n"
        f"{_lang_rule(output_language)}\n\n"
        + (grounded if ctx_excerpt else "")
        + "Return JSON only (no markdown) with keys: topic, output_language_used, questions.\n"
        "Each question object must contain: id, question, options (4 options), correct_option_index (0..3), "
        "correct_explanation, wrong_explanation, option_explanations (length 4; short reason per option).\n"
        "Ensure exactly one correct option per question. Make distractors plausible.\n"
        "IMPORTANT RULES:\n"
        "- Return EXACTLY the requested number of questions.\n"
        "- Each question stem must ask about a *specific fact, definition, step, or contrast* from the "
        "Context (not generic prompts like 'which statement is most closely about the topic').\n"
        "- The question stem AND all four options must be written entirely in OUTPUT_LANGUAGE — "
        "never leave any part in English.\n"
        "- Do NOT prefix question text with [1], Q1., or other numbering — the app adds Q numbers.\n"
        "- When quoting a short phrase from the Context, use straight double quotes (\") not guillemets (« »).\n"
        "- No repeated questions.\n"
        "- No repeated option sets across questions.\n"
        "- Each option must be a complete claim or answer (not labels about answers).\n"
        "- NEVER use meta-labels like: 'partly incorrect statement', 'unrelated statement', "
        "'contradictory statement', 'Option 1', or any option that only describes the *type* of answer.\n"
        "- Use the Context material as the only source of facts when it is provided.\n"
        f"- Reminder: every string students read (especially the 4 options) must follow {_lang_rule(output_language).splitlines()[0]}.\n"
        + (f"\n\nContext material (source facts only — rewrite learner text in OUTPUT_LANGUAGE):\n{ctx_excerpt}" if ctx_excerpt else "")
    )
    return base


def _words(s: str) -> set[str]:
    return set(re.findall(r"[\w]{3,}", s.lower()))


def _sentences_from_context(text: str, *, min_len: int = 15) -> list[str]:
    parts = re.split(r"(?<=[.!?।])\s+|\n+", text)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        s = " ".join(p.split())
        if len(s) < min_len:
            continue
        key = s.lower()[:120]
        if key in seen:
            continue
        seen.add(key)
        out.append(s[:300])
    # Split long comma-separated clauses for more candidates
    if len(out) < 6:
        extra: list[str] = []
        for s in list(out):
            for part in re.split(r"(?<=[,;:])\s+", s):
                p = part.strip()
                if min_len <= len(p) <= 300:
                    k = p.lower()[:100]
                    if k not in seen:
                        seen.add(k)
                        extra.append(p)
        out.extend(extra)
    return out


def _option_grounded(option: str, context: str) -> bool:
    o = option.strip()
    if len(o) < 10:
        return False
    ol = o.lower()
    ctx = context.lower()
    if len(o) >= 18 and ol in ctx:
        return True
    for win in (40, 32, 24):
        for i in range(0, max(1, len(o) - win + 1), 6):
            chunk = ol[i : i + win]
            if len(chunk) >= 18 and chunk in ctx:
                return True
    ow = _words(o)
    if len(ow) < 4:
        return False
    best = 0
    for sent in _sentences_from_context(context, min_len=12):
        inter = len(ow & _words(sent))
        if inter > best:
            best = inter
    return best >= max(3, int(0.22 * len(ow)))


def _option_soft_overlap(option: str, context: str) -> bool:
    """True if enough content words from the option appear in the context (accepts paraphrases)."""
    ow = _words(option)
    cw = _words(context)
    if len(ow) < 3:
        return False
    inter = len(ow & cw)
    return inter >= max(3, int(0.2 * len(ow)))


def _question_overlaps_context(question: str, context: str, *, min_shared: int = 3) -> bool:
    qwl = _words(question)
    cwl = _words(context)
    if len(qwl & cwl) >= min_shared:
        return True
    qn = " ".join(question.lower().split())[:200]
    return len(qn) >= 24 and qn in context.lower()


def _wrong_claims_from_sentence(s: str, topic: str) -> list[str]:
    """Three plausible-but-wrong options derived from a real sentence (no template meta-phrases)."""
    s = s.strip()
    if len(s) < 15:
        return [
            f"The main ideas of {topic} are unrelated to observations in experiments.",
            f"Students can ignore definitions when studying {topic}.",
            f"{topic} has no standard terminology in textbooks.",
        ]
    a = re.sub(r"\bis\b", "is not", s, count=1, flags=re.IGNORECASE)
    if a.lower() == s.lower():
        a = re.sub(r"\bequals\b", "does not equal", s, count=1, flags=re.IGNORECASE)
    if a.lower() == s.lower():
        a = ("It is false that " + s[0].lower() + s[1:]) if len(s) > 1 else "False: " + s
    b = s.rstrip(".!?") + "; however, the lesson text rejects this exact claim."
    c = s[: max(20, len(s) // 2)].rstrip() + " … [misstated] " + "the chapter describes a different relationship."
    out = [a[:300], b[:300], c[:300]]
    seen: set[str] = {s.lower()}
    deduped: list[str] = []
    for o in out:
        k = o.lower()
        if k not in seen:
            seen.add(k)
            deduped.append(o)
    n = 0
    while len(deduped) < 3:
        n += 1
        deduped.append(f"A common exam mistake about {topic} is to confuse this with an unrelated law ({n}).")
    return deduped[:3]


def _fallback_context_sentence_quiz(
    topic: str,
    idx: int,
    context_text: str,
    output_language: OutputLanguage = "english",
) -> QuizQuestion | None:
    """Four options are distinct lines from the lesson; correct rotates by idx."""
    sents = _sentences_from_context(context_text, min_len=15)
    if len(sents) < 4:
        return None

    # Each idx focuses on a different sentence so questions are not clones.
    corr_i = idx % len(sents)
    corr_sent = sents[corr_i]
    others: list[str] = []
    for offset in range(1, len(sents)):
        cand = sents[(corr_i + offset) % len(sents)]
        if cand[:90].lower() == corr_sent[:90].lower():
            continue
        if all(cand[:90].lower() != o[:90].lower() for o in others):
            others.append(cand)
        if len(others) >= 3:
            break
    if len(others) < 3:
        return None

    correct_idx = idx % 4
    options = [""] * 4
    options[correct_idx] = corr_sent
    slots = [i for i in range(4) if i != correct_idx]
    for slot, o in zip(slots, others[:3]):
        options[slot] = o

    n = idx + 1
    stem = _fallback_stems(output_language, n, topic, focus=corr_sent)
    return QuizQuestion(
        id=f"q{n}",
        question=stem,
        options=options,
        correct_option_index=correct_idx,
        correct_explanation=_fallback_explanations(output_language, correct=True),
        wrong_explanation=_fallback_explanations(output_language, correct=False),
        option_explanations=[_fallback_explanations(output_language, correct=True)] * 4,
    )


def _fallback_question(
    topic: str,
    idx: int,
    context_text: str | None,
    output_language: OutputLanguage = "english",
) -> QuizQuestion:
    ctx = (context_text or "").strip()
    # Ground in lesson sentences for every language. Non-English options stay as
    # source-language text briefly; `_force_localize_quiz` translates them.
    if ctx:
        cq = _fallback_context_sentence_quiz(topic, idx, ctx, output_language)
        if cq is not None:
            oex = [
                _fallback_explanations(output_language, correct=(j == cq.correct_option_index))
                for j in range(4)
            ]
            return cq.model_copy(update={"option_explanations": oex})

        sents = _sentences_from_context(ctx)
        n = idx + 1
        correct_idx = idx % 4
        if sents:
            base = sents[idx % len(sents)]
            wrong = _wrong_claims_from_sentence(base, topic)
            options = [""] * 4
            options[correct_idx] = base
            slots = [i for i in range(4) if i != correct_idx]
            for slot, w in zip(slots, wrong):
                options[slot] = w
            qtext = _fallback_stems(output_language, n, topic, focus=base)
            return QuizQuestion(
                id=f"q{n}",
                question=qtext,
                options=options,
                correct_option_index=correct_idx,
                correct_explanation=_fallback_explanations(output_language, correct=True),
                wrong_explanation=_fallback_explanations(output_language, correct=False),
                option_explanations=[
                    _fallback_explanations(output_language, correct=(j == correct_idx))
                    for j in range(4)
                ],
            )

    n = idx + 1
    # No usable context: vary template by idx so pads are not identical clones.
    templates = {
        "hindi": (
            (
                f"\"{topic}\" के लिए पाठ्यक्रम आमतौर पर सबसे पहले क्या जानने की अपेक्षा करता है?",
                [
                    f"{topic} के भीतर मुख्य शब्द, परिभाषाएँ और उनका संबंध।",
                    f"{topic} अध्यायों में कभी न आने वाला असंबंधित ज्ञान।",
                    f"कि {topic} परीक्षाओं में कभी नहीं पूछा जाता।",
                    f"कि {topic} पढ़ते समय आरेख छोड़ देने चाहिए।",
                ],
                "परिभाषाएँ और संबंध आमतौर पर आधार होते हैं।",
                "अन्य विकल्प गंभीर अध्ययन लक्ष्य नहीं हैं।",
            ),
            (
                f"\"{topic}\" पढ़ते समय कौन-सा अभ्यास सबसे उपयोगी है?",
                [
                    f"मुख्य परिभाषाओं को उदाहरणों से जोड़ना।",
                    f"हर आरेख को बिना पढ़े छोड़ देना।",
                    f"केवल याद रखना कि {topic} परीक्षा में नहीं आता।",
                    f"पाठ्यपुस्तक की शब्दावली को अनदेखा करना।",
                ],
                "परिभाषाओं को उदाहरणों से जोड़ना सीखने में मदद करता है।",
                "अन्य विकल्प प्रभावी अध्ययन नहीं हैं।",
            ),
            (
                f"\"{topic}\" में भ्रम से बचने के लिए पहले क्या स्पष्ट होना चाहिए?",
                [
                    f"मुख्य शब्दों का अर्थ और उनके आपसी संबंध।",
                    f"कि {topic} का कोई मानक नाम नहीं है।",
                    f"कि चित्रों की कोई भूमिका नहीं होती।",
                    f"कि केवल अंतिम पृष्ठ पर्याप्त है।",
                ],
                "शब्दावली और संबंध आधार बनाते हैं।",
                "बाकी विकल्प आधार नहीं बनाते।",
            ),
            (
                f"\"{topic}\" की समीक्षा करते समय सही क्रम कौन-सा है?",
                [
                    f"परिभाषा → उदाहरण → जाँच प्रश्न।",
                    f"केवल याद किए गए तथ्य बिना समझ के।",
                    f"सबसे पहले परीक्षा परिणाम देखना।",
                    f"विषय छोड़कर अन्य अध्याय पढ़ना।",
                ],
                "परिभाषा से उदाहरण तक बढ़ना प्रभावी है।",
                "अन्य क्रम सीखने के लिए उपयुक्त नहीं।",
            ),
        ),
        "roman_hindi": (
            (
                f"\"{topic}\" ke liye textbooks usually pehle kya jaanna expect karti hain?",
                [
                    f"{topic} ke andar key terms, definitions aur unka connection.",
                    f"{topic} chapters mein kabhi na aane wala unrelated trivia.",
                    f"Ki {topic} exams mein kabhi assess nahi hota.",
                    f"Ki {topic} padhte waqt diagrams skip kar deni chahiye.",
                ],
                "Definitions aur relationships usual foundation hote hain.",
                "Baaki choices serious study goals nahi hain.",
            ),
            (
                f"\"{topic}\" padhte waqt kaunsa practice sabse useful hai?",
                [
                    f"Key definitions ko examples se jodna.",
                    f"Har diagram bina padhe skip kar dena.",
                    f"Sirf yeh maan lena ki {topic} exam mein nahi aata.",
                    f"Textbook vocabulary ko ignore karna.",
                ],
                "Definitions ko examples se jodna learning mein madad karta hai.",
                "Baaki options effective study nahi hain.",
            ),
            (
                f"\"{topic}\" mein confusion avoid karne ke liye pehle kya clear hona chahiye?",
                [
                    f"Key terms ka matlab aur unka aapas mein rishta.",
                    f"Ki {topic} ka koi standard naam nahi hai.",
                    f"Ki diagrams ki koi role nahi hoti.",
                    f"Ki sirf last page kaafi hai.",
                ],
                "Vocabulary aur relationships foundation banate hain.",
                "Baaki options foundation nahi bante.",
            ),
            (
                f"\"{topic}\" revise karte waqt sahi order kaunsa hai?",
                [
                    f"Definition → example → check question.",
                    f"Sirf rote facts bina samajh ke.",
                    f"Sabse pehle exam result dekhna.",
                    f"Topic chhod kar dusra chapter padhna.",
                ],
                "Definition se example tak badhna effective hai.",
                "Baaki orders seekhne ke liye suitable nahi.",
            ),
        ),
        "english": (
            (
                f"For \"{topic}\", what do textbooks usually expect you to know first?",
                [
                    f"Key terms, definitions, and how they connect within {topic}.",
                    f"Unrelated trivia that never appears in {topic} chapters.",
                    f"That {topic} is never assessed in exams.",
                    f"That you should skip diagrams when studying {topic}.",
                ],
                "Definitions and relationships are the usual foundation.",
                "The other choices are not serious study goals.",
            ),
            (
                f"While studying \"{topic}\", which practice is most useful?",
                [
                    "Connecting key definitions to worked examples.",
                    "Skipping every diagram without reading it.",
                    f"Assuming {topic} never appears on exams.",
                    "Ignoring the textbook vocabulary entirely.",
                ],
                "Linking definitions to examples supports learning.",
                "The other choices are not effective study habits.",
            ),
            (
                f"To avoid confusion in \"{topic}\", what should be clear first?",
                [
                    "The meaning of key terms and how they relate.",
                    f"That {topic} has no standard terminology.",
                    "That diagrams play no role in understanding.",
                    "That only the final page of the chapter matters.",
                ],
                "Vocabulary and relationships form the foundation.",
                "The other choices do not establish a foundation.",
            ),
            (
                f"When reviewing \"{topic}\", which sequence works best?",
                [
                    "Definition → example → check question.",
                    "Rote facts without checking understanding.",
                    "Looking at exam scores before studying.",
                    "Skipping the topic to read another chapter.",
                ],
                "Building from definition to examples is effective.",
                "The other sequences are not good for learning.",
            ),
        ),
    }

    lang_key = output_language if output_language in ("hindi", "roman_hindi", "english") else "english"
    bundle = templates[lang_key][idx % len(templates[lang_key])]
    question, options, correct_explanation, wrong_explanation = bundle
    return QuizQuestion(
        id=f"q{n}",
        question=question,
        options=list(options),
        correct_option_index=0,
        correct_explanation=correct_explanation,
        wrong_explanation=wrong_explanation,
        option_explanations=[
            correct_explanation,
            wrong_explanation,
            wrong_explanation,
            wrong_explanation,
        ],
    )

_BOILERPLATE_SUBSTR = (
    "partly incorrect statement mixing",
    "unrelated statement that does not explain",
    "contradictory statement about",
    "conceptually correct statement about",
)


def _looks_like_boilerplate_options(options: list[str]) -> bool:
    joined = " ".join(o.lower() for o in options)
    return any(b in joined for b in _BOILERPLATE_SUBSTR)


def _fallback_reason(
    q: QuizQuestion,
    context_text: str | None,
    output_language: OutputLanguage = "english",
) -> str | None:
    """Return why an LLM question must be replaced, or None if it is acceptable."""
    opts = [o.strip() for o in (q.options or []) if o and o.strip()]
    if len(opts) < 4:
        return "fewer_than_four_options"
    if _looks_like_boilerplate_options(opts):
        return "boilerplate_options"
    if len({o.lower() for o in opts}) < 4:
        return "duplicate_options"
    pad_labels = {language_option_pad(output_language, j).lower() for j in range(1, 5)}
    pad_labels.update({f"option {j}" for j in range(1, 5)})
    pad_labels.update({f"vikalp {j}" for j in range(1, 5)})
    if any(o.lower() in pad_labels or re.match(r"^option\s*\d+\s*$", o, re.I) for o in opts):
        return "placeholder_option_labels"
    return None


def _question_needs_fallback(
    q: QuizQuestion,
    context_text: str | None,
    output_language: OutputLanguage = "english",
) -> bool:
    """Only replace structurally broken LLM output — never reject for grounding overlap."""
    return _fallback_reason(q, context_text, output_language) is not None


def _normalize_questions(
    parsed: QuizGenerateResponse,
    topic: str,
    question_count: int,
    context_text: str | None,
    output_language: OutputLanguage = "english",
) -> QuizGenerateResponse:
    qs: list[QuizQuestion] = []
    seen_q: set[str] = set()
    for i, q in enumerate(parsed.questions):
        options = [o.strip() for o in (q.options or [])[:4] if o and o.strip()]
        if len(options) < 4:
            options += [_option_pad_label(output_language, j) for j in range(len(options) + 1, 5)]
        deduped: list[str] = []
        seen_opt: set[str] = set()
        for opt in options:
            key = opt.lower().strip()
            if key not in seen_opt:
                seen_opt.add(key)
                deduped.append(opt)
        options = deduped[:4]
        if len(options) < 4:
            options += [_option_pad_label(output_language, j) for j in range(len(options) + 1, 5)]

        q_key = _question_dedupe_key(q.question)
        if not q_key or q_key in seen_q:
            continue
        seen_q.add(q_key)

        idx = q.correct_option_index if 0 <= q.correct_option_index < 4 else 0
        oex = q.option_explanations[:4] if q.option_explanations else None
        if oex is not None and len(oex) < 4:
            oex += [q.wrong_explanation] * (4 - len(oex))

        built = q.model_copy(
            update={
                "id": f"q{i + 1}",
                "question": _clean_question_text(q.question),
                "options": [_normalize_quotes(o) for o in options],
                "correct_option_index": idx,
                "option_explanations": oex,
            }
        )
        fb_reason = _fallback_reason(built, context_text, output_language)
        if fb_reason:
            logger.info(
                "Replacing LLM quiz question q%s with fallback (%s): %s",
                i + 1,
                fb_reason,
                built.question[:120],
            )
            built = _fallback_question(topic, i, context_text, output_language).model_copy(
                update={"id": f"q{i + 1}"}
            )
            fb_key = _question_dedupe_key(built.question)
            if fb_key in seen_q:
                # Try a few later indices to get a distinct fallback.
                replaced = False
                for alt in range(i + 1, i + 12):
                    candidate = _fallback_question(topic, alt, context_text, output_language)
                    alt_key = _question_dedupe_key(candidate.question)
                    if alt_key not in seen_q:
                        built = candidate.model_copy(update={"id": f"q{i + 1}"})
                        fb_key = alt_key
                        replaced = True
                        break
                if not replaced:
                    continue
            # Replace the LLM key already in seen_q isn't needed — we used LLM key.
            # Track the fallback stem so pads don't clone it.
            seen_q.add(fb_key)
        qs.append(built)

    pad_idx = len(qs)
    guard = 0
    while len(qs) < question_count and guard < question_count * 8:
        guard += 1
        logger.info(
            "Padding quiz with fallback question (%s/%s collected from LLM path)",
            len(qs),
            question_count,
        )
        built = _fallback_question(topic, pad_idx, context_text, output_language)
        pad_idx += 1
        fb_key = _question_dedupe_key(built.question)
        if fb_key in seen_q:
            continue
        seen_q.add(fb_key)
        qs.append(built.model_copy(update={"id": f"q{len(qs) + 1}"}))

    # Ensure stable sequential ids
    qs = [
        _normalize_quiz_question(q.model_copy(update={"id": f"q{i + 1}"}))
        for i, q in enumerate(qs[:question_count])
    ]
    return parsed.model_copy(update={"questions": qs})


def _strip_response_json_fences(raw: str) -> str:
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def _extract_json_obj(raw: str) -> dict | None:
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


def _coerce_llm_questions(raw_questions: object) -> list[QuizQuestion]:
    """Salvage valid questions when the LLM returns a partially malformed array."""
    if not isinstance(raw_questions, list):
        return []
    out: list[QuizQuestion] = []
    for i, item in enumerate(raw_questions):
        if not isinstance(item, dict):
            continue
        question = _clean_question_text(str(item.get("question", "")).strip())
        raw_opts = item.get("options")
        if not isinstance(raw_opts, list):
            continue
        options = [str(o).strip() for o in raw_opts if o is not None and str(o).strip()]
        if len(question) < 8 or len(options) < 4:
            continue
        try:
            idx = int(item.get("correct_option_index", 0))
        except (TypeError, ValueError):
            idx = 0
        idx = max(0, min(3, idx))
        oex = item.get("option_explanations")
        option_explanations = None
        if isinstance(oex, list):
            option_explanations = [str(x).strip() for x in oex[:4] if x is not None]
            if len(option_explanations) < 4:
                option_explanations = None
        try:
            out.append(
                QuizQuestion(
                    id=str(item.get("id") or f"q{i + 1}"),
                    question=question,
                    options=options[:4],
                    correct_option_index=idx,
                    correct_explanation=str(item.get("correct_explanation") or "Correct.").strip()[:2000],
                    wrong_explanation=str(item.get("wrong_explanation") or "Incorrect.").strip()[:2000],
                    option_explanations=option_explanations,
                )
            )
        except ValidationError:
            continue
    return out


def _parse_llm_quiz_response(
    data: dict,
    *,
    topic: str,
    output_language: OutputLanguage,
) -> QuizGenerateResponse:
    questions = _coerce_llm_questions(data.get("questions"))
    if not questions:
        try:
            return QuizGenerateResponse.model_validate(
                {
                    "topic": data.get("topic", topic),
                    "output_language_used": data.get("output_language_used", output_language),
                    "questions": data.get("questions", []),
                }
            )
        except ValidationError:
            return QuizGenerateResponse(
                topic=topic,
                output_language_used=output_language,
                questions=[],
            )
    return QuizGenerateResponse(
        topic=str(data.get("topic", topic))[:200],
        output_language_used=output_language,
        questions=questions,
    )


def _question_wrong_language(q: QuizQuestion, output_language: OutputLanguage) -> bool:
    """Detect quiz items that still contain English or the wrong script."""
    if output_language == "english":
        return False
    fields: list[str] = [q.question, q.correct_explanation, q.wrong_explanation]
    fields.extend(o for o in (q.options or []) if o and o.strip())
    if q.option_explanations:
        fields.extend(x for x in q.option_explanations if x and str(x).strip())
    return any(learner_text_wrong_language(f, output_language) for f in fields)


def _options_wrong_language(q: QuizQuestion, output_language: OutputLanguage) -> bool:
    """Backward-compatible alias; checks all learner-facing fields."""
    return _question_wrong_language(q, output_language)


def _quiz_needs_localization(questions: list[QuizQuestion], output_language: OutputLanguage) -> bool:
    if output_language == "english":
        return False
    return any(_options_wrong_language(q, output_language) for q in questions)


async def _localize_quiz_batch(
    *,
    questions: list[QuizQuestion],
    start_index: int,
    output_language: OutputLanguage,
    llm_provider: str,
) -> list[QuizQuestion]:
    """Translate one small batch of quiz questions into the target language."""
    target = localization_target_description(output_language)
    payload = []
    for offset, q in enumerate(questions):
        payload.append(
            {
                "index": start_index + offset,
                "question": q.question,
                "options": list(q.options),
                "correct_option_index": q.correct_option_index,
                "correct_explanation": q.correct_explanation,
                "wrong_explanation": q.wrong_explanation,
                "option_explanations": q.option_explanations or [],
            }
        )

    provider = get_llm_provider(vision=False, provider=llm_provider)
    lang_rule = _lang_rule(output_language)
    messages: list[Message] = [
        {
            "role": "system",
            "content": (
                "You are a precise translator for school MCQ quizzes. "
                "Output strict JSON only. Preserve meaning, option order, and correct_option_index. "
                "Never leave any learner-facing text in English. "
                f"{lang_rule}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Rewrite EVERY field below into {target}.\n"
                f"{lang_rule}\n"
                "Rules:\n"
                "- Translate question stem, all 4 options, correct_explanation, wrong_explanation, "
                "and option_explanations.\n"
                "- The question stem must be fully in the target language — no English sentences.\n"
                "- Keep exactly 4 options per item, same order/meaning, same correct_option_index.\n"
                "- Do NOT copy English words except unavoidable formulas/symbols "
                "(e.g. c, λ, f).\n"
                '- Return ONLY JSON shaped as: '
                '{"items":[{"index":0,"question":"...","options":["a","b","c","d"],'
                '"correct_explanation":"...","wrong_explanation":"...",'
                '"option_explanations":["...","...","...","..."]}]}\n\n'
                f"ITEMS_JSON:\n{json.dumps(payload, ensure_ascii=False)}"
            ),
        },
    ]
    raw = await provider.complete_chat(messages, max_tokens=5000, temperature=0.0)
    data = _extract_json_obj(raw) or {}
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        raise ValueError("Localization returned no items")

    by_index: dict[int, dict] = {}
    for it in items:
        if not isinstance(it, dict) or "index" not in it:
            continue
        try:
            idx = int(it["index"])
        except (TypeError, ValueError):
            continue
        by_index[idx] = it

    updated: list[QuizQuestion] = []
    for offset, q in enumerate(questions):
        idx = start_index + offset
        it = by_index.get(idx)
        if not it:
            updated.append(q)
            continue
        opts = it.get("options")
        if not isinstance(opts, list) or len(opts) < 4:
            updated.append(q)
            continue
        clean_opts = [str(o).strip() for o in opts[:4]]
        if any(not o for o in clean_opts):
            updated.append(q)
            continue
        oex = it.get("option_explanations")
        patch: dict = {
            "question": _clean_question_text(str(it.get("question") or q.question).strip() or q.question),
            "options": [_normalize_quotes(o) for o in clean_opts],
            "correct_explanation": _normalize_quotes(
                str(it.get("correct_explanation") or q.correct_explanation)
            ),
            "wrong_explanation": _normalize_quotes(
                str(it.get("wrong_explanation") or q.wrong_explanation)
            ),
        }
        if isinstance(oex, list) and len(oex) >= 4:
            patch["option_explanations"] = [_normalize_quotes(str(x)) for x in oex[:4]]
        candidate = q.model_copy(update=patch)
        if _question_wrong_language(candidate, output_language):
            updated.append(q)
        else:
            updated.append(candidate)
    return updated


async def _force_localize_quiz(
    *,
    questions: list[QuizQuestion],
    output_language: OutputLanguage,
    llm_provider: str,
) -> list[QuizQuestion]:
    """
    Localization pass for non-English quizzes.

    Rewrites questions whose stems, options, or explanations are still in the wrong language.
    Batched when every question needs translation to avoid truncated responses.
    """
    if output_language == "english" or not questions:
        return questions

    batch_size = 3
    result = list(questions)

    for attempt in range(3):
        if not _quiz_needs_localization(result, output_language):
            break
        # On first attempt localize everything that is wrong-language; on retry only leftovers.
        targets = [i for i, q in enumerate(result) if _question_wrong_language(q, output_language)]
        if not targets:
            break

        logger.info(
            "Quiz localization pass %s for %s: %s question(s)",
            attempt + 1,
            output_language,
            len(targets),
        )

        if attempt == 0 and len(targets) == len(result):
            for start in range(0, len(result), batch_size):
                chunk = result[start : start + batch_size]
                try:
                    localized = await _localize_quiz_batch(
                        questions=chunk,
                        start_index=start,
                        output_language=output_language,
                        llm_provider=llm_provider,
                    )
                    result[start : start + len(localized)] = localized
                except Exception as e:  # noqa: BLE001
                    logger.warning("Quiz localization batch starting at %s failed: %s", start, e)
        else:
            for i in targets:
                try:
                    localized = await _localize_quiz_batch(
                        questions=[result[i]],
                        start_index=i,
                        output_language=output_language,
                        llm_provider=llm_provider,
                    )
                    if localized:
                        result[i] = localized[0]
                except Exception as e:  # noqa: BLE001
                    logger.warning("Quiz localization retry for q%s failed: %s", i, e)

    still_bad = sum(1 for q in result if _question_wrong_language(q, output_language))
    if still_bad:
        logger.warning("Quiz localization finished with %s question(s) still wrong-language", still_bad)
    else:
        logger.info("Quiz localization succeeded for all questions (%s)", output_language)
    return result


async def generate_quiz(
    *,
    topic: str,
    context_text: str | None,
    output_language: OutputLanguage,
    question_count: int,
    difficulty: str,
    llm_provider: str,
) -> QuizGenerateResponse:
    provider = get_llm_provider(vision=False, provider=llm_provider)
    collected: list[QuizQuestion] = []
    seen: set[str] = set()
    ctx = (context_text or "").strip()
    temp = 0.22 if ctx else 0.42
    max_tok = 9000 if ctx else 5000

    for attempt in range(3):
        remaining = question_count - len(collected)
        if remaining <= 0:
            break

        avoid = ""
        if collected:
            prev = [q.question for q in collected]
            avoid = "\nAlready generated questions (do NOT repeat):\n- " + "\n- ".join(prev[:20])

        grounding_note = (
            "When CONTEXT is provided, every question and all four options must be factually grounded "
            "in that CONTEXT. If OUTPUT_LANGUAGE is not english, write options in OUTPUT_LANGUAGE only — "
            "never paste English quotes as options."
        )
        messages: list[Message] = [
            {
                "role": "system",
                "content": (
                    "You output strict JSON only. "
                    f"{grounding_note} "
                    f"{_lang_rule(output_language)}"
                ),
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
                + avoid
                + f"\nAttempt: {attempt + 1}",
            },
        ]

        raw = await provider.complete_chat(messages, max_tokens=max_tok, temperature=temp)
        data = _extract_json_obj(raw) or {}
        if not data:
            logger.warning("Quiz LLM attempt %s returned unparsable JSON", attempt + 1)
        parsed_try = _parse_llm_quiz_response(
            data,
            topic=topic,
            output_language=output_language,
        )
        if not parsed_try.questions:
            logger.warning(
                "Quiz LLM attempt %s produced 0 usable questions (raw length=%s)",
                attempt + 1,
                len(raw),
            )

        normalized_try = _normalize_questions(
            parsed_try,
            topic=topic,
            question_count=max(len(parsed_try.questions), 1),
            context_text=context_text,
            output_language=output_language,
        )
        for q in normalized_try.questions:
            key = _question_dedupe_key(q.question)
            if key and key not in seen:
                seen.add(key)
                collected.append(q)
                if len(collected) >= question_count:
                    break

    parsed = QuizGenerateResponse(
        topic=topic,
        output_language_used=output_language,
        questions=collected,
    )
    parsed = parsed.model_copy(update={"output_language_used": output_language, "topic": topic})
    parsed = _normalize_questions(parsed, topic, question_count, context_text, output_language)

    # Mandatory second pass: English context grounding often leaves English options.
    if output_language != "english":
        fixed = await _force_localize_quiz(
            questions=list(parsed.questions),
            output_language=output_language,
            llm_provider=llm_provider,
        )
        parsed = parsed.model_copy(
            update={"questions": [_normalize_quiz_question(q) for q in fixed]}
        )

    return parsed.model_copy(
        update={"questions": [_normalize_quiz_question(q) for q in parsed.questions]}
    )
