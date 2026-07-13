from datetime import datetime

from pydantic import BaseModel, Field


class QuizQuestionInput(BaseModel):
    id: str
    number: int
    prompt: str
    options: list[str] = Field(default_factory=list)
    answer_index: int = Field(alias="answerIndex")
    correct_explanation: str | None = Field(default=None, alias="correctExplanation")
    wrong_explanation: str | None = Field(default=None, alias="wrongExplanation")

    model_config = {"populate_by_name": True}


class QuizAttemptSubmit(BaseModel):
    project_id: str = Field(min_length=1, max_length=64)
    answers: dict[str, int]
    time_taken_seconds: int = Field(ge=1)
    questions: list[QuizQuestionInput] | None = None


class QuizResultItemResponse(BaseModel):
    number: int
    prompt: str
    options: list[str]
    your_answer_index: int = Field(alias="yourAnswerIndex")
    correct_answer_index: int = Field(alias="correctAnswerIndex")
    is_correct: bool = Field(alias="isCorrect")
    explanation: str | None = None

    model_config = {"populate_by_name": True}


class QuizResultResponse(BaseModel):
    id: int
    project_id: str
    score: int
    total: int
    percent: int
    passed: bool
    time_taken_seconds: int = Field(alias="timeTakenSeconds")
    submitted_at: datetime
    items: list[QuizResultItemResponse]

    model_config = {"populate_by_name": True}


class GroupQuizResultItem(BaseModel):
    student_id: int | None
    student_email: str
    student_name: str | None
    percent: int | None
    passed: bool | None
    submitted_at: datetime | None
