from fastapi import APIRouter, HTTPException, Response

from app.schemas.language import normalize_output_language
from app.schemas.slides import SlideDeckGenerateRequest, SlideDeckResponse
from app.services import slides as slides_service

router = APIRouter()


@router.post("/generate", response_model=SlideDeckResponse)
async def generate_slide_deck(body: SlideDeckGenerateRequest) -> SlideDeckResponse:
    stack = (body.stack or "openai").lower().strip()
    llm_provider = "openai" if stack == "openai" else "ollama"
    lang = normalize_output_language(body.output_language)

    try:
        return await slides_service.generate_slide_deck(
            topic=body.topic.strip(),
            context_text=body.context_text,
            output_language=lang,
            slide_count=body.slide_count,
            llm_provider=llm_provider,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Slide deck generation failed: {e!s}") from e


@router.get("/{deck_id}/media/{name}")
async def slide_media(deck_id: str, name: str) -> Response:
    data = await slides_service.get_media_file(deck_id, name)
    if not data:
        raise HTTPException(status_code=404, detail="Slide image not found or expired.")
    content, media_type = data
    return Response(content=content, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})


@router.get("/{deck_id}/file")
async def download_slide_deck(deck_id: str) -> Response:
    data = await slides_service.get_deck_file(deck_id)
    if not data:
        raise HTTPException(status_code=404, detail="Slide deck not found or expired.")
    pptx_bytes, filename = data
    return Response(
        content=pptx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
