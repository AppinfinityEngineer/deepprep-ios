from fastapi import APIRouter
from pydantic import BaseModel
from . import db

router = APIRouter()


class PrivacyDeleteIn(BaseModel):
    deviceId: str


@router.post("/privacy/delete")
async def privacy_delete(body: PrivacyDeleteIn):
    """Delete user-generated data for a device.

    We delete reports and interviews. We RETAIN a minimal fraud-prevention
    record on the device row (freeScanUsed + hashes) because deleting it would
    let a user bypass the free-scan abuse protection by reinstalling. We strip
    any directly identifying fields and keep only irreversible hashes.
    TODO(branch-7): finalise retention policy with legal for production.
    """
    reports_deleted = (await db.reports.delete_many({"deviceId": body.deviceId})).deleted_count
    interviews_deleted = (await db.interviews.delete_many({"deviceId": body.deviceId})).deleted_count
    await db.usage.delete_many({"_id": body.deviceId})

    # Keep device row but mark deleted + drop the linked report id.
    await db.devices.update_one(
        {"_id": body.deviceId},
        {"$set": {"dataDeleted": True, "freeScanReportId": None}},
    )
    return {
        "deleted": True,
        "reportsDeleted": reports_deleted,
        "interviewsDeleted": interviews_deleted,
        "note": "Minimal irreversible fraud-prevention hashes retained per policy.",
    }
