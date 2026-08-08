QUIZ_PASS_THRESHOLD = 0.6


def _question_dict(q: dict) -> dict:
    """Normalize quiz question from snapshot or API input."""
    return {
        "id": q.get("id", ""),
        "number": q.get("number", 0),
        "prompt": q.get("prompt") or q.get("question", ""),
        "options": q.get("options") or [],
        "answer_index": q.get("answerIndex", q.get("answer_index", 0)),
        "correct_explanation": q.get("correctExplanation") or q.get("correct_explanation"),
        "wrong_explanation": q.get("wrongExplanation") or q.get("wrong_explanation"),
    }


def extract_quiz_from_snapshot(snapshot: dict | None) -> list[dict]:
    if not snapshot:
        return []
    quiz = snapshot.get("results", {}).get("quiz")
    if not isinstance(quiz, list):
        return []
    return [_question_dict(q) for q in quiz if isinstance(q, dict)]


def questions_from_input(questions: list | None) -> list[dict]:
    if not questions:
        return []
    normalized: list[dict] = []
    for q in questions:
        if isinstance(q, dict):
            normalized.append(_question_dict(q))
        else:
            normalized.append(
                {
                    "id": q.id,
                    "number": q.number,
                    "prompt": q.prompt,
                    "options": q.options,
                    "answer_index": q.answer_index,
                    "correct_explanation": q.correct_explanation,
                    "wrong_explanation": q.wrong_explanation,
                }
            )
    return normalized


def score_quiz(
    questions: list[dict],
    answers: dict[str, int],
    time_taken_seconds: int,
) -> dict:
    items: list[dict] = []
    for q in questions:
        your_index = answers.get(q["id"], -1)
        correct_index = int(q.get("answer_index", 0))
        is_correct = your_index == correct_index
        explanation = (
            q.get("correct_explanation")
            if is_correct
            else q.get("wrong_explanation") or q.get("correct_explanation")
        )
        items.append(
            {
                "number": q.get("number", 0),
                "prompt": q.get("prompt", ""),
                "options": q.get("options") or [],
                "yourAnswerIndex": your_index,
                "correctAnswerIndex": correct_index,
                "isCorrect": is_correct,
                "explanation": explanation,
            }
        )

    score = sum(1 for item in items if item["isCorrect"])
    total = len(items)
    percent = round((score / total) * 100) if total else 0
    passed = total > 0 and (score / total) >= QUIZ_PASS_THRESHOLD

    return {
        "score": score,
        "total": total,
        "percent": percent,
        "passed": passed,
        "timeTakenSeconds": time_taken_seconds,
        "items": items,
    }


def attempt_to_response(attempt) -> dict:
    return {
        "id": attempt.id,
        "project_id": attempt.project_id,
        "score": attempt.score,
        "total": attempt.total,
        "percent": attempt.percent,
        "passed": attempt.passed,
        "timeTakenSeconds": attempt.time_taken_seconds,
        "submitted_at": attempt.submitted_at,
        "items": attempt.result_items,
    }
