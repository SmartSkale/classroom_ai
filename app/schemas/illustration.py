from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.language import OutputLanguage


class IllustrationRequest(BaseModel):
    """Generate an educational illustration from AI or Pexels stock photos.

    Prefer `topic` + `context_text` for AI generation (backend rewrites a visual prompt).
    `prompt` remains supported for Pexels search and simple one-shot prompts.
    """

    prompt: str | None = Field(
        default=None,
        min_length=4,
        max_length=3900,
        description="Direct prompt (Pexels query, or short scene). Prefer topic+context for AI.",
    )
    topic: str | None = Field(
        default=None,
        min_length=2,
        max_length=200,
        description="Lesson / project title used to rewrite a focused illustration prompt.",
    )
    context_text: str | None = Field(
        default=None,
        max_length=30000,
        description="Lesson excerpt; used only to ground the LLM rewrite (not sent raw to image API).",
    )
    output_language: OutputLanguage = "english"
    stack: str = Field(default="openai", description="openai | opensource")
    source: Literal["ai", "pexels"] = Field(
        default="ai",
        description="ai = OpenAI/SD image model; pexels = stock photo (requires PEXELS_API_KEY).",
    )
    style: str = Field(
        default=(
            "Clean textbook-style educational illustration, accurate proportions, soft natural lighting, "
            "school-friendly colors, optional short readable labels for key parts, uncluttered composition, "
            "no watermark, no logo, no dense paragraphs of text."
        ),
        description="Appended to the model prompt for look and safety.",
    )

    @model_validator(mode="after")
    def _require_prompt_or_topic(self) -> "IllustrationRequest":
        if self.source == "pexels":
            if not (self.prompt or "").strip() and not (self.topic or "").strip():
                raise ValueError("Pexels source requires prompt or topic.")
            return self
        if not (self.prompt or "").strip() and not (self.topic or "").strip():
            raise ValueError("Provide prompt and/or topic for illustration generation.")
        return self


class IllustrationResponse(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    image_prompt_used: str = Field(
        default="",
        description="Final visual prompt used for AI generation (empty for Pexels).",
    )
