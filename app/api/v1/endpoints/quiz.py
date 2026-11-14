from fastapi import APIRouter, HTTPException, Response

from app.schemas.language import normalize_output_language
from app.schemas.quiz import QuizGenerateRequest, QuizGenerateResponse
from app.services import quiz as quiz_service
from app.services.quiz_export import build_quiz_xlsx

router = APIRouter()

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(body: QuizGenerateRequest) -> QuizGenerateResponse:
    stack = (body.stack or "openai").lower().strip()
    llm_provider = "openai" if stack == "openai" else "ollama"
    lang = normalize_output_language(body.output_language)
    if body.easy_count + body.medium_count + body.hard_count == 0:
        raise HTTPException(status_code=400, detail="Choose at least one easy, medium, or hard question.")

    try:
        return await quiz_service.generate_quiz(
            topic=body.topic.strip(),
            context_text=body.context_text,
            output_language=lang,
            easy_count=body.easy_count,
            medium_count=body.medium_count,
            hard_count=body.hard_count,
            llm_provider=llm_provider,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Quiz generation failed: {e!s}") from e


@router.post("/export.xlsx")
async def export_quiz_xlsx(body: QuizGenerateResponse) -> Response:
    """Excel export of a quiz the client already has. Stateless: the body is the quiz."""
    if not body.questions:
        raise HTTPException(status_code=400, detail="The quiz has no questions to export.")
    content, filename = build_quiz_xlsx(body)
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
