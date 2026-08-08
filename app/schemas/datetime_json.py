from datetime import datetime, timezone


def as_utc_datetime(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC for API clients."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
