from fastapi import APIRouter, Depends

from app.api.v1.endpoints import audio, auth, explain, flashcards, illustration, infographic, quiz, slides, video
from app.core.deps import get_current_user

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

protected_router = APIRouter(dependencies=[Depends(get_current_user)])
protected_router.include_router(explain.router, prefix="/explain", tags=["explain"])
protected_router.include_router(video.router, prefix="/video", tags=["video"])
protected_router.include_router(illustration.router, prefix="/illustration", tags=["illustration"])
protected_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
protected_router.include_router(slides.router, prefix="/slides", tags=["slides"])
protected_router.include_router(audio.router, prefix="/audio", tags=["audio"])
protected_router.include_router(flashcards.router, prefix="/flashcards", tags=["flashcards"])
protected_router.include_router(infographic.router, prefix="/infographic", tags=["infographic"])

api_router.include_router(protected_router)
