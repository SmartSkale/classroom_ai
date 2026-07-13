from fastapi import APIRouter

from app.core.deps import CurrentUser
from app.schemas.usage import UsageResponse

router = APIRouter()

FREE_PLAN_LIMIT = 30


@router.get("/current", response_model=UsageResponse)
async def get_current_usage(current_user: CurrentUser) -> UsageResponse:
    # Placeholder until generation usage is tracked per user in the database.
    _ = current_user
    return UsageResponse(
        used=12,
        limit=FREE_PLAN_LIMIT,
        period_label="This Month",
        plan="free",
    )
