"""Development-only helpers.

These routes must never be enabled in production. They exist only to make Expo
and Render dev testing repeatable while keeping production free-scan caps
server-authoritative.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import db
from .config import get_settings

router = APIRouter(prefix="/dev")


class DevResetFreeScanIn(BaseModel):
    deviceId: str


@router.post("/reset-free-scan")
async def reset_free_scan(body: DevResetFreeScanIn):
    settings = get_settings()
    if settings.app_env != "development" or not settings.allow_dev_mock_unlock:
        # Avoid advertising the endpoint outside dev mode.
        raise HTTPException(status_code=404, detail="Not found")

    device_id = body.deviceId.strip()
    if not device_id:
        raise HTTPException(status_code=400, detail="deviceId is required")

    reports_deleted = (await db.reports.delete_many({"deviceId": device_id})).deleted_count
    interviews_deleted = (await db.interviews.delete_many({"deviceId": device_id})).deleted_count
    usage_deleted = (await db.usage.delete_many({"_id": device_id})).deleted_count
    entitlements_deleted = (await db.entitlements.delete_many({"_id": device_id})).deleted_count
    device_deleted = (await db.devices.delete_many({"_id": device_id})).deleted_count

    return {
        "ok": True,
        "deviceId": device_id,
        "deviceDeleted": device_deleted,
        "reportsDeleted": reports_deleted,
        "interviewsDeleted": interviews_deleted,
        "usageDeleted": usage_deleted,
        "entitlementsDeleted": entitlements_deleted,
    }
