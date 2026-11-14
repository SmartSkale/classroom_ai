from typing import Literal

from pydantic import BaseModel, Field


class PresenterScriptRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    context_text: str | None = Field(default=None, max_length=30000)
    output_language: Literal["english", "hindi", "roman_hindi"] = "english"
    stack: str = Field(default="openai", description="openai | opensource")
    segment_count: int = Field(default=5, ge=2, le=8)


class PresenterSegment(BaseModel):
    heading: str
    narration: str
    expression: Literal["neutral", "happy", "excited", "thinking"] = "neutral"


class PresenterScript(BaseModel):
    title: str
    output_language_used: Literal["english", "hindi", "roman_hindi"]
    segments: list[PresenterSegment]
