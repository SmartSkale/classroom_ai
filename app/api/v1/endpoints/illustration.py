import base64
import logging

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.illustration import IllustrationRequest, IllustrationResponse
from app.services import illustration as illustration_service
from app.services.pexels_stock import fetch_landscape_photo_bytes

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=IllustrationResponse)
async def create_illustration(body: IllustrationRequest) -> IllustrationResponse:
    """Generate an illustration from AI, open-source, or Pexels sources."""
    settings = get_settings()
    stack = (body.stack or "openai").lower().strip()
    source = body.source.lower().strip() if body.source else "ai"
    topic_or_prompt = (body.topic or body.prompt or "")[:50]

    logger.info(f"Illustration request: source={source}, stack={stack}, topic/prompt={topic_or_prompt}")

    try:
        if source == "pexels":
            key = (settings.pexels_api_key or "").strip()
            if not key:
                raise ValueError(
                    "PEXELS_API_KEY is required for stock photos. Add it to .env to enable this feature."
                )
            query = (body.prompt or body.topic or "").strip()
            out = await fetch_landscape_photo_bytes(key, query)
            if not out:
                logger.warning(f"No Pexels stock photo found for: {query}")
                raise ValueError(
                    "No stock photo matched this prompt. Try simpler keywords like 'science', 'classroom', or 'experiment'."
                )
            raw, mime, _attr = out
            b64 = base64.b64encode(raw).decode("ascii")
            logger.info("Stock photo retrieved successfully")
            return IllustrationResponse(image_base64=b64, mime_type=mime, image_prompt_used="")

        b64, mime, prompt_used = await illustration_service.generate_ai_illustration(
            prompt=body.prompt,
            topic=body.topic,
            context_text=body.context_text,
            output_language=body.output_language,
            stack=stack,
            style=body.style,
        )
        logger.info("Image generated successfully")
    except ValueError as e:
        logger.warning(f"Illustration validation error: {e!s}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.error(f"Illustration runtime error: {e!s}")
        raise HTTPException(
            status_code=502,
            detail=f"Image generation failed: {e!s}. Ensure all required services are configured.",
        ) from e
    except Exception as e:
        logger.error(f"Unexpected illustration error: {e!s}")
        raise HTTPException(
            status_code=502,
            detail=f"Image generation error: {str(e)[:200]}",
        ) from e

    return IllustrationResponse(image_base64=b64, mime_type=mime, image_prompt_used=prompt_used)
