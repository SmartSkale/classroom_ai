import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(str, enum.Enum):
    teacher = "teacher"
    student = "student"
    course_creator = "course_creator"
    parent = "parent"
    admin = "admin"


# Upload / Project Library / generation persistence (includes parents).
CONTENT_ROLES = (
    UserRole.teacher,
    UserRole.course_creator,
    UserRole.parent,
    UserRole.admin,
)

# Class groups, assignments, and group quiz scoreboards (excludes parents).
GROUP_ROLES = (
    UserRole.teacher,
    UserRole.course_creator,
    UserRole.admin,
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=False),
        nullable=False,
        default=UserRole.student,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
