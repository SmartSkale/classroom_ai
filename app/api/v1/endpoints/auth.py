import anyio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse, UserRegister, UserResponse

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
        return user

    return await anyio.to_thread.run_sync(_register)


@router.post("/login", response_model=TokenResponse)
async def login(db: DbSession, form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    # bcrypt verification and sync SQLAlchemy calls block; run them off the event loop.
    def _authenticate() -> User:
        user = db.query(User).filter(User.email == form_data.username.lower()).first()
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
    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: CurrentUser) -> User:
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: DbSession,
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> list[User]:
    # Sync SQLAlchemy query blocks; run it off the event loop.
    return await anyio.to_thread.run_sync(
        lambda: db.query(User).order_by(User.created_at.desc()).all()
    )
