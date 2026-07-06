"""Small shared helpers."""
import hashlib
import uuid
from datetime import datetime, timezone


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def week_key() -> str:
    d = datetime.now(timezone.utc).isocalendar()
    return f"{d.year}-W{d.week:02d}"


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
