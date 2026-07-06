"""Development-only helpers.

These routes must never be enabled in production. They exist only to make Expo
and Render dev testing repeatable while keeping production free-scan caps
server-authoritative.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import db
from .config import get_settings

router = APIRouter(prefix="/dev")


class DevResetFreeScanIn(BaseModel):
    deviceId: Optional[str] = None


def _assert_dev_enabled() -> None:
    settings = get_settings()
    if settings.app_env != "development" or not settings.allow_dev_mock_unlock:
        # Avoid advertising the endpoint outside dev mode.
        raise HTTPException(status_code=404, detail="Not found")


async def _reset_device(device_id: str) -> dict:
    reports_deleted = (await db.reports.delete_many({"$or": [{"deviceId": device_id}, {"_id": device_id}]})).deleted_count
    interviews_deleted = (await db.interviews.delete_many({"$or": [{"deviceId": device_id}, {"_id": device_id}]})).deleted_count
    usage_deleted = (await db.usage.delete_many({"$or": [{"deviceId": device_id}, {"_id": device_id}]})).deleted_count
    entitlements_deleted = (await db.entitlements.delete_many({"$or": [{"deviceId": device_id}, {"_id": device_id}]})).deleted_count
    device_deleted = (await db.devices.delete_many({"$or": [{"deviceId": device_id}, {"_id": device_id}]})).deleted_count

    return {
        "deviceId": device_id,
        "deviceDeleted": device_deleted,
        "reportsDeleted": reports_deleted,
        "interviewsDeleted": interviews_deleted,
        "usageDeleted": usage_deleted,
        "entitlementsDeleted": entitlements_deleted,
    }


@router.post("/reset-free-scan")
async def reset_free_scan(body: DevResetFreeScanIn):
    _assert_dev_enabled()

    device_id = (body.deviceId or "").strip()
    if not device_id:
        raise HTTPException(status_code=400, detail="deviceId is required")

    result = await _reset_device(device_id)
    return {"ok": True, **result}


@router.post("/reset-all-free-scans")
async def reset_all_free_scans():
    """Nuclear dev reset for Expo testing.

    This intentionally deletes generated dev test records so the same local
    build can run onboarding repeatedly. It is disabled unless the backend is
    explicitly running in development with ALLOW_DEV_MOCK_UNLOCK=true.
    """
    _assert_dev_enabled()

    reports_deleted = (await db.reports.delete_many({})).deleted_count
    interviews_deleted = (await db.interviews.delete_many({})).deleted_count
    usage_deleted = (await db.usage.delete_many({})).deleted_count
    entitlements_deleted = (await db.entitlements.delete_many({})).deleted_count
    devices_deleted = (await db.devices.delete_many({})).deleted_count

    return {
        "ok": True,
        "mode": "development_reset_all",
        "devicesDeleted": devices_deleted,
        "reportsDeleted": reports_deleted,
        "interviewsDeleted": interviews_deleted,
        "usageDeleted": usage_deleted,
        "entitlementsDeleted": entitlements_deleted,
    }
