import anyio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.email_validation import normalize_and_validate_email
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import (
    MessageResponse,
    PasswordChange,
    PasswordForgotRequest,
    PasswordResetRequest,
    TokenResponse,
    UserRegister,
    UserResponse,
    UserUpdate,
    UserUpdateResponse,
)
from app.services.group_memberships import link_user_to_group_memberships
from app.services.password_reset import request_password_reset, reset_password_with_token

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: DbSession) -> User:
    # bcrypt hashing and sync SQLAlchemy calls block; run them off the event loop.
    def _register() -> User:
        existing = db.query(User).filter(User.email == body.email.lower()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
            )

        if body.role == UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin accounts cannot be created via public registration",
            )

        user = User(
            email=body.email.lower(),
            hashed_password=hash_password(body.password),
            full_name=body.full_name.strip(),
            role=body.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        link_user_to_group_memberships(db, user)
        return user

    return await anyio.to_thread.run_sync(_register)


@router.post("/login", response_model=TokenResponse)
async def login(db: DbSession, form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    try:
        login_email = normalize_and_validate_email(form_data.username)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # bcrypt verification and sync SQLAlchemy calls block; run them off the event loop.
    def _authenticate() -> User:
        user = db.query(User).filter(User.email == login_email).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
        return user

    user = await anyio.to_thread.run_sync(_authenticate)
    await anyio.to_thread.run_sync(lambda: link_user_to_group_memberships(db, user))
    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserUpdateResponse)
async def update_current_user(
    body: UserUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> UserUpdateResponse:
    def _update() -> UserUpdateResponse:
        email_changed = False
        new_token: str | None = None

        if body.email is not None:
            normalized_email = body.email.lower()
            if normalized_email != current_user.email:
                existing = db.query(User).filter(User.email == normalized_email).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Email already in use",
                    )
                current_user.email = normalized_email
                email_changed = True

        if body.full_name is not None:
            current_user.full_name = body.full_name.strip()

        db.add(current_user)
        db.commit()
        db.refresh(current_user)

        if email_changed:
            new_token = create_access_token(current_user.email)

        return UserUpdateResponse(user=current_user, access_token=new_token)

    return await anyio.to_thread.run_sync(_update)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: PasswordChange,
    db: DbSession,
    current_user: CurrentUser,
) -> MessageResponse:
    def _change_password() -> MessageResponse:
        if not verify_password(body.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        current_user.hashed_password = hash_password(body.new_password)
        db.add(current_user)
        db.commit()
        return MessageResponse(message="Password changed successfully")

    return await anyio.to_thread.run_sync(_change_password)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: PasswordForgotRequest, db: DbSession) -> MessageResponse:
    def _forgot() -> MessageResponse:
        message = request_password_reset(db, body.email)
        return MessageResponse(message=message)

    return await anyio.to_thread.run_sync(_forgot)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: PasswordResetRequest, db: DbSession) -> MessageResponse:
    def _reset() -> MessageResponse:
        try:
            reset_password_with_token(db, body.token, body.new_password)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        return MessageResponse(message="Password reset successfully. You can log in with your new password.")

    return await anyio.to_thread.run_sync(_reset)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: DbSession,
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> list[User]:
    # Sync SQLAlchemy query blocks; run it off the event loop.
    return await anyio.to_thread.run_sync(
        lambda: db.query(User).order_by(User.created_at.desc()).all()
    )
