"""Free-scan eligibility + creation with multi-layer abuse protection.

Layers:
  1. Per-device record (freeScanUsed) — server-authoritative, survives reinstall
     because the client persists anonymousDeviceId in the Keychain.
  2. Global daily cap (FREE_SCAN_DAILY_GLOBAL_CAP).
  3. IP / user-agent hashes stored for later fraud analysis.
  4. App Attest / DeviceCheck token slot (verification stubbed).

TODO(branch-6): verify attestToken via Apple DeviceCheck / App Attest.
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone

from .. import db
from ..config import get_settings
from ..models import InterviewerIn, Report
from ..utils import now_iso, sha256, today_key
from . import report_service


async def check_eligibility(device_id: str, ip: Optional[str], user_agent: Optional[str], attest_token: Optional[str]) -> Dict:
    settings = get_settings()

    # TODO(branch-6): if settings.app_attest_enabled and not verify(attest_token): reject.

    dev = await db.devices.find_one({"_id": device_id}, {"_id": 0})
    if dev and dev.get("freeScanUsed"):
        return {
            "eligible": False,
            "reason": "already_used",
            "message": "Your free scan has already been used on this device. Unlock DeepPrep Pro to create full briefs.",
            "freeScanReportId": dev.get("freeScanReportId"),
        }

    # Global daily cap.
    start_of_day = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00+00:00")
    used_today = await db.devices.count_documents({"freeScanUsedAt": {"$gte": start_of_day}})
    if used_today >= settings.free_scan_daily_global_cap:
        return {
            "eligible": False,
            "reason": "global_cap",
            "message": "DeepPrep is at capacity today. Please try again later or unlock Pro.",
        }

    return {"eligible": True, "reason": "ok"}


async def create_free_scan(
    device_id: str,
    company: str,
    role: str,
    jd_text,
    date,
    interviewers: List[InterviewerIn],
    ip: Optional[str],
    user_agent: Optional[str],
    attest_token: Optional[str],
) -> Report:
    elig = await check_eligibility(device_id, ip, user_agent, attest_token)
    if not elig["eligible"]:
        raise FreeScanError(elig["message"], elig["reason"], elig.get("freeScanReportId"))

    # Persist a lightweight interview record.
    from ..models import Interview, Interviewer
    interview = Interview(
        company=company, role=role, jdText=jd_text, date=date,
        interviewers=[Interviewer(**iv.model_dump()) for iv in interviewers],
        status="free_scan",
    )
    await db.interviews.update_one({"_id": interview.id}, {"$set": {**interview.model_dump(), "deviceId": device_id}}, upsert=True)

    report = await report_service.build_free_scan_report(interview.id, company, role, jd_text, date, interviewers)
    await db.reports.update_one({"_id": report.id}, {"$set": {**report.model_dump(), "deviceId": device_id}}, upsert=True)

    await db.interviews.update_one({"_id": interview.id}, {"$set": {"reportId": report.id, "status": "ready", "updatedAt": now_iso()}})
    await db.devices.update_one(
        {"_id": device_id},
        {"$set": {
            "deviceId": device_id,
            "freeScanUsed": True,
            "freeScanUsedAt": now_iso(),
            "freeScanReportId": report.id,
            "ipHash": sha256(ip) if ip else None,
            "userAgentHash": sha256(user_agent) if user_agent else None,
        }, "$setOnInsert": {"createdAt": now_iso()}},
        upsert=True,
    )
    return report


class FreeScanError(Exception):
    def __init__(self, message: str, reason: str, report_id: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.reason = reason
        self.report_id = report_id
