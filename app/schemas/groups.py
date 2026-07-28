from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.email_validation import normalize_and_validate_email
from app.models.groups import GroupMemberStatus


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class GroupMemberResponse(BaseModel):
    id: int
    email: str
    user_id: int | None
    status: GroupMemberStatus
    invited_at: datetime

    model_config = {"from_attributes": True}


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    assignment_count: int = 0
    project_assigned: bool = False

    model_config = {"from_attributes": True}


class GroupDetailResponse(GroupResponse):
    members: list[GroupMemberResponse] = []


class GroupMembersAdd(BaseModel):
    emails: list[str] = Field(min_length=1)

    @field_validator("emails")
    @classmethod
    def validate_emails(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for raw in values:
            email = normalize_and_validate_email(raw)
            if email not in normalized:
                normalized.append(email)
        return normalized


class GroupAssignmentCreate(BaseModel):
    project_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    outputs: list[str] = Field(default_factory=list)
    content_snapshot: dict | None = None


class GroupAssignmentResponse(BaseModel):
    id: int
    group_id: int
    project_id: str
    title: str
    outputs: list[str]
    assigned_at: datetime

    model_config = {"from_attributes": True}


class StudentAssignmentResponse(BaseModel):
    assignment_id: int
    group_id: int
    group_name: str
    project_id: str
    title: str
    outputs: list[str]
    assigned_at: datetime
    content_snapshot: dict | None = None
    last_quiz_percent: int | None = None
    last_quiz_passed: bool | None = None
