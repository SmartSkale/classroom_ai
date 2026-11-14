from fastapi import APIRouter, HTTPException

from app.schemas.language import normalize_output_language
from app.schemas.presenter import PresenterScript, PresenterScriptRequest
from app.services import presenter as presenter_service

router = APIRouter()


@router.post("/script", response_model=PresenterScript)
async def presenter_script(body: PresenterScriptRequest) -> PresenterScript:
    stack = (body.stack or "openai").lower().strip()
    llm_provider = "openai" if stack == "openai" else "ollama"
    lang = normalize_output_language(body.output_language)
    try:
        return await presenter_service.generate_script(
            topic=body.topic.strip(),
            context_text=body.context_text,
            output_language=lang,
            segment_count=body.segment_count,
            llm_provider=llm_provider,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Presenter script failed: {e!s}") from e
