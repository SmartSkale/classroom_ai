"""Quiz quality checks. Run from the repo root: python -m pytest app/services/test_quiz.py"""

import asyncio
import json
import random

from app.schemas.quiz import QuizQuestion
from app.services import quiz as quiz_service

TOPIC = "Chapter 6: How Plants Make Their Food (Photosynthesis)"


def _q(question: str, options: list[str], correct: int = 0) -> QuizQuestion:
    return QuizQuestion(
        id="q1",
        question=question,
        options=options,
        correct_option_index=correct,
        correct_explanation="Because it is the stated fact.",
        wrong_explanation="The others describe different processes.",
        option_explanations=["a", "b", "c", "d"],
    )


def test_rejects_chapter_title_and_source_references():
    assert not quiz_service._usable(
        _q(f"According to the lesson, which statement matches {TOPIC}?", ["a fact", "b fact", "c fact", "d fact"]),
        TOPIC,
    )
    assert not quiz_service._usable(
        _q("Which is the main idea?", [TOPIC, "Water splits", "Oxygen forms", "Sugar is stored"]),
        TOPIC,
    )


def test_rejects_meta_and_duplicate_options():
    assert not quiz_service._usable(
        _q("Where does photosynthesis mainly occur?", ["The leaf", "The root", "All of the above", "The stem"]),
        TOPIC,
    )
    assert not quiz_service._usable(
        _q("Where does photosynthesis mainly occur?", ["The leaf", "the leaf", "The root", "The stem"]),
        TOPIC,
    )


def test_accepts_exam_style_question():
    good = _q(
        "Which pigment absorbs light energy in a chloroplast?",
        ["Chlorophyll", "Starch", "Cellulose", "Stomata"],
    )
    assert quiz_service._usable(good, TOPIC)


def test_shuffle_keeps_the_correct_answer_text():
    q = _q(
        "Which gas is released during photosynthesis?",
        ["Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"],
        correct=1,
    )
    for seed in range(20):
        shuffled = quiz_service._shuffled(q, random.Random(seed))
        assert shuffled.options[shuffled.correct_option_index] == "Oxygen"
        assert sorted(shuffled.options) == sorted(q.options)


class _FakeProvider:
    def __init__(self, replies: list[str]):
        self.replies = replies

    async def complete_chat(self, messages, max_tokens, temperature):  # noqa: ARG002
        return self.replies.pop(0)


def _reply(questions: list[dict]) -> str:
    return json.dumps({"topic": TOPIC, "output_language_used": "english", "questions": questions})


def test_generate_drops_bad_questions_and_returns_good_ones(monkeypatch):
    good = {
        "question": "Which pigment absorbs light energy in a chloroplast?",
        "options": ["Chlorophyll", "Starch", "Cellulose", "Stomata"],
        "correct_option_index": 0,
        "correct_explanation": "Chlorophyll absorbs light.",
        "wrong_explanation": "The others are not pigments.",
        "option_explanations": ["Correct pigment.", "Storage sugar.", "Cell wall material.", "Leaf pore."],
    }
    bad = {
        "question": f"According to the lesson, what is {TOPIC}?",
        "options": ["one", "two", "three", "four"],
        "correct_option_index": 0,
    }
    provider = _FakeProvider([_reply([bad, good])])
    monkeypatch.setattr(quiz_service, "get_llm_provider", lambda **_: provider)

    result = asyncio.run(
        quiz_service.generate_quiz(
            topic=TOPIC,
            context_text="Chlorophyll absorbs light energy in the chloroplast.",
            output_language="english",
            easy_count=1,
            medium_count=0,
            hard_count=0,
            llm_provider="ollama",
        )
    )
    assert len(result.questions) == 1
    assert result.questions[0].difficulty == "easy"
    assert result.questions[0].question.startswith("Which pigment")
    assert result.questions[0].options[result.questions[0].correct_option_index] == "Chlorophyll"


def test_generate_raises_when_nothing_usable(monkeypatch):
    provider = _FakeProvider(["not json"] * quiz_service.MAX_ATTEMPTS)
    monkeypatch.setattr(quiz_service, "get_llm_provider", lambda **_: provider)
    try:
        asyncio.run(
            quiz_service.generate_quiz(
                topic=TOPIC,
                context_text=None,
                output_language="english",
                easy_count=3,
                medium_count=0,
                hard_count=0,
                llm_provider="ollama",
            )
        )
    except ValueError as e:
        assert "usable exam questions" in str(e)
    else:
        raise AssertionError("expected ValueError when the model returns nothing usable")
