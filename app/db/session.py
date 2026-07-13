from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal= sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

#initialize the database-->create the tables
def init_db() -> None:
    import app.models.groups  # noqa: F401
    import app.models.project  # noqa: F401
    import app.models.quiz_attempt  # noqa: F401
    import app.models.user  # noqa: F401 — register models with metadata

    from app.db.base import Base

    Base.metadata.create_all(bind=engine)
