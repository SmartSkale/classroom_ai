from functools import lru_cache
from pathlib import Path

from email_validator import EmailNotValidError, validate_email

from app.core.config import get_settings

_TLD_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "valid_tlds.txt"


@lru_cache
def _valid_tlds() -> frozenset[str]:
    if not _TLD_DATA_FILE.is_file():
        raise RuntimeError(f"Missing TLD data file: {_TLD_DATA_FILE}")
    return frozenset(line.strip().lower() for line in _TLD_DATA_FILE.read_text().splitlines() if line.strip())


def _friendly_email_error(raw: str) -> str:
    lowered = raw.lower()
    if "does not exist" in lowered or "no mx" in lowered:
        return "Enter a valid email address with a real domain (e.g. you@example.com)."
    return "Enter a valid email address (e.g. you@example.com)."


def normalize_and_validate_email(value: str, *, check_deliverability: bool | None = None) -> str:
    email = value.strip()
    if not email:
        raise ValueError("Email is required.")

    if check_deliverability is None:
        check_deliverability = get_settings().email_check_deliverability

    try:
        result = validate_email(email, check_deliverability=check_deliverability)
    except EmailNotValidError as exc:
        raise ValueError(_friendly_email_error(str(exc))) from exc

    domain = result.domain.lower()
    tld = domain.rsplit(".", 1)[-1]
    if tld not in _valid_tlds():
        raise ValueError("Enter a valid email address (e.g. you@example.com).")

    return result.normalized
