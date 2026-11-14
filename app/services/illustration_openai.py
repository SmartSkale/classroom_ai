import base64

from openai import AsyncOpenAI

from app.core.config import Settings


async def generate_image_bytes(
    settings: Settings,
    *,
    prompt: str,
    size: str = "1536x1024",
    quality: str = "medium",
) -> bytes:
    """Generate one image with the configured OpenAI image model and return the raw image bytes."""
    if not settings.openai_api_key or not settings.openai_api_key.strip():
        raise ValueError("OPENAI_API_KEY is required for image generation.")
    client = AsyncOpenAI(api_key=settings.openai_api_key.strip())
    result = await client.images.generate(
        model=settings.openai_image_model,
        prompt=prompt[:4000],
        size=size,
        quality=quality,
        n=1,
    )
    if not result.data or not result.data[0].b64_json:
        raise RuntimeError("Image API returned no image data.")
    return base64.b64decode(result.data[0].b64_json)


async def generate_illustration_png_b64(
    settings: Settings,
    *,
    prompt: str,
    style_suffix: str,
) -> tuple[str, str]:
    if not settings.openai_api_key or not settings.openai_api_key.strip():
        raise ValueError("OPENAI_API_KEY is required for illustration generation.")
    client = AsyncOpenAI(api_key=settings.openai_api_key.strip())
    full_prompt = f"{prompt.strip()}\n\nStyle: {style_suffix.strip()}"

    # gpt-image models always return base64 and do not accept `response_format` or DALL·E quality names.
    result = await client.images.generate(
        model=settings.openai_image_model,
        prompt=full_prompt[:4000],
        size="1024x1024",
        quality="high",
        n=1,
    )
    if not result.data or not result.data[0].b64_json:
        raise RuntimeError("Image API returned no image data.")
    return result.data[0].b64_json, "image/png"
