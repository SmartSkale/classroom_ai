import re
from typing import Literal, NamedTuple

OutputLanguage = Literal[
    "english",
    "hindi",
    "roman_hindi",
    "bengali",
    "marathi",
    "telugu",
    "tamil",
]

OUTPUT_LANGUAGE_ALIASES: dict[str, OutputLanguage] = {
    "english": "english",
    "en": "english",
    "hindi": "hindi",
    "hi": "hindi",
    "devanagari": "hindi",
    "roman_hindi": "roman_hindi",
    "roman": "roman_hindi",
    "hinglish": "roman_hindi",
    "latin_hindi": "roman_hindi",
    "bengali": "bengali",
    "bn": "bengali",
    "bangla": "bengali",
    "marathi": "marathi",
    "mr": "marathi",
    "telugu": "telugu",
    "te": "telugu",
    "tamil": "tamil",
    "ta": "tamil",
}


class LanguageMeta(NamedTuple):
    display_name: str
    script_rule: str
    script_ranges: tuple[tuple[int, int], ...]
    edge_voice: str
    option_pad: str  # template with {n}


LANGUAGE_META: dict[OutputLanguage, LanguageMeta] = {
    "english": LanguageMeta(
        display_name="English",
        script_rule="All learner-facing text must be in English.",
        script_ranges=(),
        edge_voice="en-US-AriaNeural",
        option_pad="Option {n}",
    ),
    "hindi": LanguageMeta(
        display_name="Hindi",
        script_rule=(
            "CRITICAL LANGUAGE RULE — OUTPUT_LANGUAGE=hindi (Devanagari):\n"
            "- All learner-facing text (stems, options, explanations, labels) MUST be written "
            "in Hindi Devanagari script.\n"
            "- NEVER leave options or explanations in English (Latin letters), even if the "
            "source Context is English.\n"
            "- If the Context is English, TRANSLATE ideas into Hindi; do not paste English quotes.\n"
            "- Write Hindi (हिंदी) only — do NOT use Marathi or other Devanagari languages.\n"
            "- Proper nouns / formulas may stay in Latin only when unavoidable."
        ),
        script_ranges=((0x0900, 0x097F),),
        edge_voice="hi-IN-SwaraNeural",
        option_pad="विकल्प {n}",
    ),
    "roman_hindi": LanguageMeta(
        display_name="Roman Hindi",
        script_rule=(
            "CRITICAL LANGUAGE RULE — OUTPUT_LANGUAGE=roman_hindi:\n"
            "- All learner-facing text MUST be Roman Hindi (Latin letters only, no Devanagari).\n"
            "- NEVER leave options in English textbook prose; rewrite them as Roman Hindi.\n"
            "- If the Context is English, translate/adapt each option into Roman Hindi."
        ),
        script_ranges=(),
        edge_voice="en-IN-PrabhatNeural",
        option_pad="Vikalp {n}",
    ),
    "bengali": LanguageMeta(
        display_name="Bengali",
        script_rule=(
            "CRITICAL LANGUAGE RULE — OUTPUT_LANGUAGE=bengali (Bengali script):\n"
            "- All learner-facing text MUST be written in Bengali script (বাংলা).\n"
            "- NEVER leave options or explanations in English, even if the Context is English.\n"
            "- Translate / adapt ideas from the Context into Bengali; do not paste English quotes.\n"
            "- Proper nouns / formulas may stay in Latin only when unavoidable."
        ),
        script_ranges=((0x0980, 0x09FF),),
        edge_voice="bn-IN-TanishaaNeural",
        option_pad="বিকল্প {n}",
    ),
    "marathi": LanguageMeta(
        display_name="Marathi",
        script_rule=(
            "CRITICAL LANGUAGE RULE — OUTPUT_LANGUAGE=marathi (Devanagari):\n"
            "- All learner-facing text MUST be written in Marathi using Devanagari script.\n"
            "- NEVER leave options or explanations in English, even if the Context is English.\n"
            "- Translate / adapt ideas from the Context into Marathi; do not paste English quotes.\n"
            "- Proper nouns / formulas may stay in Latin only when unavoidable."
        ),
        script_ranges=((0x0900, 0x097F),),
        edge_voice="mr-IN-AarohiNeural",
        option_pad="पर्याय {n}",
    ),
    "telugu": LanguageMeta(
        display_name="Telugu",
        script_rule=(
            "CRITICAL LANGUAGE RULE — OUTPUT_LANGUAGE=telugu (Telugu script):\n"
            "- All learner-facing text MUST be written in Telugu script (తెలుగు).\n"
            "- NEVER leave options or explanations in English, even if the Context is English.\n"
            "- Translate / adapt ideas from the Context into Telugu; do not paste English quotes.\n"
            "- Proper nouns / formulas may stay in Latin only when unavoidable."
        ),
        script_ranges=((0x0C00, 0x0C7F),),
        edge_voice="te-IN-ShrutiNeural",
        option_pad="ఎంపిక {n}",
    ),
    "tamil": LanguageMeta(
        display_name="Tamil",
        script_rule=(
            "CRITICAL LANGUAGE RULE — OUTPUT_LANGUAGE=tamil (Tamil script):\n"
            "- All learner-facing text MUST be written in Tamil script (தமிழ்).\n"
            "- NEVER leave options or explanations in English, even if the Context is English.\n"
            "- Translate / adapt ideas from the Context into Tamil; do not paste English quotes.\n"
            "- Proper nouns / formulas may stay in Latin only when unavoidable."
        ),
        script_ranges=((0x0B80, 0x0BFF),),
        edge_voice="ta-IN-PallaviNeural",
        option_pad="விருப்பம் {n}",
    ),
}


def normalize_output_language(raw: str | None) -> OutputLanguage:
    if raw is None or not str(raw).strip():
        return "english"
    key = str(raw).lower().strip().replace("-", "_")
    return OUTPUT_LANGUAGE_ALIASES.get(key, "english")


def language_display_name(lang: OutputLanguage) -> str:
    return LANGUAGE_META[lang].display_name


def language_script_rule(lang: OutputLanguage) -> str:
    return LANGUAGE_META[lang].script_rule


def language_edge_voice(lang: OutputLanguage) -> str:
    return LANGUAGE_META[lang].edge_voice


def language_option_pad(lang: OutputLanguage, n: int) -> str:
    return LANGUAGE_META[lang].option_pad.format(n=n)


def _char_in_ranges(ch: str, ranges: tuple[tuple[int, int], ...]) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in ranges)


def script_char_count(text: str, lang: OutputLanguage) -> int:
    ranges = LANGUAGE_META[lang].script_ranges
    if not ranges:
        return 0
    return sum(1 for c in text if _char_in_ranges(c, ranges))


def has_target_script(text: str, lang: OutputLanguage, *, min_chars: int = 1) -> bool:
    """True when text contains enough characters in the language's native script."""
    ranges = LANGUAGE_META[lang].script_ranges
    if not ranges:
        return False
    return script_char_count(text, lang) >= min_chars


def _latin_letter_count(text: str) -> int:
    return sum(1 for c in text if ("A" <= c <= "Z") or ("a" <= c <= "z"))


def looks_english_learner_text(text: str) -> bool:
    """True when text is mostly Latin/English rather than an Indic script."""
    t = (text or "").strip()
    if not t:
        return False
    latin = _latin_letter_count(t)
    # Count any common Indic script block used by our languages.
    indic = sum(
        1
        for c in t
        if _char_in_ranges(
            c,
            (
                (0x0900, 0x097F),  # Devanagari
                (0x0980, 0x09FF),  # Bengali
                (0x0B80, 0x0BFF),  # Tamil
                (0x0C00, 0x0C7F),  # Telugu
            ),
        )
    )
    if latin == 0:
        return False
    if latin >= 4 and indic == 0:
        return True
    return latin >= 6 and latin > indic * 2


_ROMAN_HINDI_HINT = re.compile(
    r"\b(hai|hain|ka|ki|ke|ko|mein|se|aur|ya|nahi|kya|jo|wala|wali|tha|thi|the)\b",
    re.IGNORECASE,
)


def learner_text_wrong_language(text: str, lang: OutputLanguage) -> bool:
    """True when a learner-facing string is not in the requested output language."""
    t = (text or "").strip()
    if not t or lang == "english":
        return False
    if lang == "roman_hindi":
        if not looks_english_learner_text(t):
            return False
        words = re.findall(r"[A-Za-z]+", t)
        return len(words) >= 6 and not _ROMAN_HINDI_HINT.search(t)
    if looks_english_learner_text(t):
        return True
    return not has_target_script(t, lang)


def language_visible_text_rule(lang: OutputLanguage, *, surface: str = "visible labels") -> str:
    """Short clause for image/poster prompts about on-image language."""
    name = LANGUAGE_META[lang].display_name
    if lang == "english":
        return f"All {surface} must be in English"
    if lang == "roman_hindi":
        return f"All {surface} must be in Roman Hindi (Latin letters only)"
    if lang in ("hindi", "marathi"):
        return f"All {surface} must be in {name} using Devanagari script"
    if lang == "bengali":
        return f"All {surface} must be in Bengali script"
    if lang == "telugu":
        return f"All {surface} must be in Telugu script"
    if lang == "tamil":
        return f"All {surface} must be in Tamil script"
    return f"All {surface} must be in {name}"


def language_prompt_label_block(lang: OutputLanguage) -> str:
    """Language block for LLM image-prompt rewrites (illustration / infographic)."""
    name = language_display_name(lang)
    if lang == "english":
        return (
            "OUTPUT LANGUAGE is English. Any visible labels MUST be short English words "
            "(2–5 words). Quote those exact labels in the visual_prompt.\n"
        )
    if lang == "roman_hindi":
        return (
            "OUTPUT LANGUAGE is Roman Hindi. Any visible labels MUST be short Roman Hindi "
            "(Latin letters only, 2–5 words). Quote those exact labels in the visual_prompt.\n"
        )
    script = {
        "hindi": "Hindi Devanagari",
        "marathi": "Marathi Devanagari",
        "bengali": "Bengali script",
        "telugu": "Telugu script",
        "tamil": "Tamil script",
    }.get(lang, name)
    return (
        f"OUTPUT LANGUAGE is {name}. Any visible labels on the illustration MUST be short "
        f"{script} words (2–5 words). Quote those exact labels in the visual_prompt. "
        "Do not use English labels except unavoidable scientific symbols.\n"
    )


def localization_target_description(lang: OutputLanguage) -> str:
    """Short target description for localization / translation prompts."""
    if lang == "english":
        return "English"
    if lang == "roman_hindi":
        return "Roman Hindi (Hindi in Latin letters only, no Devanagari)."
    if lang == "hindi":
        return (
            "Hindi written only in Devanagari script (देवनागरी). "
            "Every option MUST contain Devanagari letters. "
            "Use Hindi (हिंदी) vocabulary — NOT Marathi or other languages."
        )
    if lang == "marathi":
        return (
            "Marathi written only in Devanagari script. "
            "Every option MUST contain Devanagari letters."
        )
    if lang == "bengali":
        return (
            "Bengali written only in Bengali script (বাংলা). "
            "Every option MUST contain Bengali letters."
        )
    if lang == "telugu":
        return (
            "Telugu written only in Telugu script (తెలుగు). "
            "Every option MUST contain Telugu letters."
        )
    if lang == "tamil":
        return (
            "Tamil written only in Tamil script (தமிழ்). "
            "Every option MUST contain Tamil letters."
        )
    return language_display_name(lang)
