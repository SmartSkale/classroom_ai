"""Password reset token creation and consumption."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.security import (
    generate_reset_token,
    hash_password,
    hash_reset_token,
    reset_token_expiry,
)
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.email import notify_password_reset

logger = logging.getLogger(__name__)

FORGOT_PASSWORD_MESSAGE = (
    "If that email is registered, you will receive a password reset link shortly."
)


def request_password_reset(db: Session, email: str) -> str:
    """Create a reset token and email the link. Always returns a generic message."""
    normalized = email.lower().strip()
    user = db.query(User).filter(User.email == normalized).first()
    if not user or not user.is_active:
        return FORGOT_PASSWORD_MESSAGE

    now = datetime.now(UTC)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)

    raw_token = generate_reset_token()
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=reset_token_expiry(),
    )
    db.add(row)
    db.commit()

    notify_password_reset(user.email, token=raw_token)
    return FORGOT_PASSWORD_MESSAGE


def reset_password_with_token(db: Session, token: str, new_password: str) -> None:
    """Validate a reset token and set a new password."""
    token_hash = hash_reset_token(token.strip())
    now = datetime.now(UTC)

    row = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
        .first()
    )
    if not row:
        raise ValueError("This reset link is invalid or has expired.")

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        raise ValueError("This reset link is invalid or has expired.")

    user.hashed_password = hash_password(new_password)
    row.used_at = now
    db.add(user)
    db.add(row)
    db.commit()
