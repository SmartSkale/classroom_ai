from datetime import datetime

from pydantic import BaseModel, Field, field_serializer

from app.schemas.datetime_json import as_utc_datetime


class ProjectUpsertRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(min_length=1, max_length=32)
    outputs: list[str] = Field(default_factory=list)
    done: bool = False
    job: dict
    created_at: datetime | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    type: str
    outputs: list[str]
    done: bool
    created_at: datetime
    updated_at: datetime
    job: dict

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, dt: datetime) -> datetime:
        return as_utc_datetime(dt)


class ProjectSummaryResponse(BaseModel):
    id: str
    name: str
    type: str
    outputs: list[str]
    done: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, dt: datetime) -> datetime:
        return as_utc_datetime(dt)
