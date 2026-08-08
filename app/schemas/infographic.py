from pydantic import BaseModel, Field

from app.schemas.language import OutputLanguage


class InfographicRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    context_text: str | None = Field(default=None, max_length=30000)
    output_language: OutputLanguage = "english"
    stack: str = Field(default="openai", description="openai | opensource")
    style: str = Field(
        default=(
            "flat vector educational infographic, bold icons, clean arrows, high contrast, "
            "short readable labels, no watermark"
        ),
        description="Appended to the image model prompt.",
    )


class InfographicResponse(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    image_prompt_used: str = Field(default="", description="Final prompt sent to the image model.")
