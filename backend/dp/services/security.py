
"""Server-side safety guards for DeepPrep.

These helpers intentionally live on the backend. The mobile app may request work,
but credit use, dev bypasses, report ownership, and abuse caps must be enforced
server-side before StoreKit is wired in.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from .. import db
from ..config import get_settings
from ..utils import now_iso


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        cleaned = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def is_development_mode() -> bool:
    settings = get_settings()
    return settings.app_env.lower() == "development"


def require_development_tooling() -> None:
    settings = get_settings()
    if settings.app_env.lower() != "development" or not settings.allow_dev_mock_unlock:
        raise HTTPException(status_code=403, detail={"reason": "dev_tooling_disabled"})


def require_device_id(device_id: str | None) -> str:
    cleaned = (device_id or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail={"reason": "device_id_required"})
    if len(cleaned) > 120:
        raise HTTPException(status_code=400, detail={"reason": "device_id_too_long"})
    return cleaned


async def assert_report_owner(report_id: str, device_id: str) -> dict[str, Any]:
    device_id = require_device_id(device_id)
    doc = await db.reports.find_one({"_id": report_id, "deviceId": device_id}, {"_id": 0, "deviceId": 0})
    if not doc:
        # Do not leak whether the report exists for another device.
        raise HTTPException(status_code=404, detail="Report not found")
    return doc


async def enforce_generation_cap(device_id: str, kind: str, limit: int, window_minutes: int) -> None:
    """Small per-device abuse cap for expensive generation endpoints.

    This is deliberately simple and Mongo-backed. It is not a substitute for
    device attestation/rate limiting later, but it prevents accidental hammering
    while we are still pre-StoreKit.
    """
    device_id = require_device_id(device_id)
    now = _utc_now()
    since = now - timedelta(minutes=window_minutes)
    key = f"{kind}:{device_id}"

    existing = await db.usage.find_one({"_id": key}) or {"_id": key, "deviceId": device_id, "kind": kind, "events": []}
    retained = []
    for item in existing.get("events", []):
        parsed = _parse_iso(item)
        if parsed and parsed >= since:
            retained.append(item)

    if len(retained) >= limit:
        await db.usage.update_one(
            {"_id": key},
            {"$set": {"events": retained, "updatedAt": now_iso(), "windowMinutes": window_minutes, "limit": limit}},
            upsert=True,
        )
        raise HTTPException(
            status_code=429,
            detail={
                "reason": "generation_rate_limited",
                "kind": kind,
                "limit": limit,
                "windowMinutes": window_minutes,
            },
        )

    retained.append(now_iso())
    await db.usage.update_one(
        {"_id": key},
        {"$set": {"events": retained, "updatedAt": now_iso(), "windowMinutes": window_minutes, "limit": limit}},
        upsert=True,
    )


async def record_cost_event(
    *,
    device_id: str,
    kind: str,
    report_id: str | None = None,
    interview_id: str | None = None,
    cost: dict[str, Any] | None = None,
    status: str = "success",
    reason: str | None = None,
) -> None:
    event = {
        "deviceId": require_device_id(device_id),
        "kind": kind,
        "reportId": report_id,
        "interviewId": interview_id,
        "status": status,
        "reason": reason,
        "cost": cost or {},
        "createdAt": now_iso(),
    }
    await db.cost_events.insert_one(event)
