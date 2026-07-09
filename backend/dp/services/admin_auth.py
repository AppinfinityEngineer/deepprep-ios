"""Token guard for private DeepPrep admin endpoints."""
from fastapi import Header, HTTPException

from ..config import get_settings


async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> str:
    settings = get_settings()
    expected = settings.admin_token
    if not expected:
        raise HTTPException(status_code=503, detail="ADMIN_TOKEN is not configured")
    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=401, detail="Not authorized")
    return x_admin_token
