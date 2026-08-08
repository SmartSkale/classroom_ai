import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.email_validation import normalize_and_validate_email
from app.models.user import UserRole

_PASSWORD_UPPER = re.compile(r"[A-Z]")
_PASSWORD_DIGIT = re.compile(r"\d")


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.student

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str) -> str:
        return normalize_and_validate_email(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str) -> str:
        return normalize_and_validate_email(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=80)
    email: EmailStr | None = None

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_and_validate_email(value)

    @model_validator(mode="after")
    def at_least_one_field(self) -> "UserUpdate":
        if self.full_name is None and self.email is None:
            raise ValueError("At least one field must be provided")
        return self


class UserUpdateResponse(BaseModel):
    user: UserResponse
    access_token: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=64)
    confirm_password: str = Field(min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        if not _PASSWORD_UPPER.search(value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not _PASSWORD_DIGIT.search(value):
            raise ValueError("Password must contain at least one number")
        return value

    @model_validator(mode="after")
    def validate_password_change(self) -> "PasswordChange":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if self.new_password == self.current_password:
            raise ValueError("New password must be different from your current password")
        return self


class PasswordForgotRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str) -> str:
        return normalize_and_validate_email(value)


class EmailValidateRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, value: str) -> str:
        return normalize_and_validate_email(value)


class EmailValidateResponse(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    new_password: str = Field(min_length=8, max_length=64)
    confirm_password: str = Field(min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        if not _PASSWORD_UPPER.search(value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not _PASSWORD_DIGIT.search(value):
            raise ValueError("Password must contain at least one number")
        return value

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordResetRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class MessageResponse(BaseModel):
    message: str
