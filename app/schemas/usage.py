from pydantic import BaseModel


class UsageResponse(BaseModel):
    used: int
    limit: int
    period_label: str
    plan: str
