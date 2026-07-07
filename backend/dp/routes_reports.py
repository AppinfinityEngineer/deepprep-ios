from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from .models import ReportCreateIn, Interview, Interviewer
from .services import report_service, entitlement_service
from .services import security
from .services.llm_provider import LLMConfigError
from .services.search_provider import SearchConfigError, SearchProviderError
from . import db
from .utils import now_iso

router = APIRouter()


async def _refund_failed_generation(device_id: str, interview_id: str, cost: int, reason: str | None = None, message: str | None = None) -> None:
    ent = await entitlement_service.get_entitlement(device_id)
    ent["credits"] = ent.get("credits", 0) + cost
    ent["updatedAt"] = now_iso()
    await db.entitlements.update_one({"_id": device_id}, {"$set": ent})
    patch = {"status": "failed", "updatedAt": now_iso()}
    if reason:
        patch["errorReason"] = reason
    if message:
        patch["errorMessage"] = message[:500]
    await db.interviews.update_one({"_id": interview_id}, {"$set": patch})


async def _create_generating_interview(body: ReportCreateIn, device_id: str) -> Interview:
    hydrated_interviewers = report_service.hydrate_interviewer_evidence(
        body.interviewers, body.profileUrl, body.profileText, limit=4
    )
    interview = Interview(
        company=body.company,
        role=body.role,
        jdText=body.jdText,
        date=body.date,
        interviewers=[Interviewer(**iv.model_dump()) for iv in hydrated_interviewers],
        status="generating",
    )
    await db.interviews.update_one(
        {"_id": interview.id},
        {"$set": {**interview.model_dump(), "deviceId": device_id, "errorReason": None, "errorMessage": None}},
        upsert=True,
    )
    return interview


async def _build_and_store_report(device_id: str, interview_id: str, body_payload: dict, cost: int) -> None:
    body = ReportCreateIn(**body_payload)
    try:
        report = await report_service.build_full_report(
            interview_id, body.company, body.role, body.jdText, body.date,
            body.interviewers, body.profileUrl, body.profileText
        )
    except SearchConfigError as e:
        await _refund_failed_generation(device_id, interview_id, cost, "search_not_configured", str(e))
        return
    except SearchProviderError as e:
        await _refund_failed_generation(device_id, interview_id, cost, "search_provider_failed", str(e))
        return
    except LLMConfigError as e:
        await _refund_failed_generation(device_id, interview_id, cost, "llm_not_configured", str(e))
        return
    except Exception as e:
        await _refund_failed_generation(device_id, interview_id, cost, "generation_failed", str(e))
        return

    await db.reports.update_one(
        {"_id": report.id},
        {"$set": {**report.model_dump(), "deviceId": device_id}},
        upsert=True,
    )
    await db.interviews.update_one(
        {"_id": interview_id},
        {"$set": {"reportId": report.id, "status": "ready", "updatedAt": now_iso()}},
    )
    await security.record_cost_event(
        device_id=device_id,
        kind="paid_report",
        report_id=report.id,
        interview_id=interview_id,
        cost=report.cost.model_dump() if hasattr(report.cost, "model_dump") else dict(report.cost or {}),
    )


@router.post("/reports")
async def create_report(body: ReportCreateIn):
    """Synchronous route retained for shell/API proof. The app should use /reports/start."""
    device_id = security.require_device_id(body.deviceId)
    await security.enforce_generation_cap(device_id, kind="paid_report", limit=8, window_minutes=60)
    cost = entitlement_service.credit_cost(len(body.interviewers), kind="brief")
    consume = await entitlement_service.consume_credits(device_id, cost)
    if not consume["ok"]:
        raise HTTPException(status_code=402, detail={"reason": consume["reason"], "credits": consume["credits"]})

    interview = await _create_generating_interview(body, device_id)

    try:
        report = await report_service.build_full_report(
            interview.id, body.company, body.role, body.jdText, body.date,
            body.interviewers, body.profileUrl, body.profileText
        )
    except SearchConfigError as e:
        await _refund_failed_generation(device_id, interview.id, cost, "search_not_configured", str(e))
        raise HTTPException(status_code=503, detail={"reason": "search_not_configured", "message": str(e)})
    except SearchProviderError as e:
        await _refund_failed_generation(device_id, interview.id, cost, "search_provider_failed", str(e))
        raise HTTPException(status_code=503, detail={"reason": "search_provider_failed", "message": str(e)})
    except LLMConfigError as e:
        await _refund_failed_generation(device_id, interview.id, cost, "llm_not_configured", str(e))
        raise HTTPException(status_code=503, detail={"reason": "llm_not_configured", "message": str(e)})
    except Exception as e:
        await _refund_failed_generation(device_id, interview.id, cost, "generation_failed", str(e))
        raise HTTPException(status_code=500, detail={"reason": "generation_failed", "message": str(e)})

    await db.reports.update_one({"_id": report.id}, {"$set": {**report.model_dump(), "deviceId": device_id}}, upsert=True)
    await db.interviews.update_one({"_id": interview.id}, {"$set": {"reportId": report.id, "status": "ready", "updatedAt": now_iso()}})
    await security.record_cost_event(
        device_id=device_id,
        kind="paid_report",
        report_id=report.id,
        interview_id=interview.id,
        cost=report.cost.model_dump() if hasattr(report.cost, "model_dump") else dict(report.cost or {}),
    )
    return {"report": report.model_dump(), "creditsRemaining": consume["credits"]}


@router.post("/reports/start")
async def start_report(body: ReportCreateIn, background_tasks: BackgroundTasks):
    """Start a full report and return immediately so the app never waits on one long HTTP request."""
    device_id = security.require_device_id(body.deviceId)
    await security.enforce_generation_cap(device_id, kind="paid_report", limit=8, window_minutes=60)
    cost = entitlement_service.credit_cost(len(body.interviewers), kind="brief")
    consume = await entitlement_service.consume_credits(device_id, cost)
    if not consume["ok"]:
        raise HTTPException(status_code=402, detail={"reason": consume["reason"], "credits": consume["credits"]})

    interview = await _create_generating_interview(body, device_id)
    background_tasks.add_task(_build_and_store_report, device_id, interview.id, body.model_dump(), cost)
    return {"interviewId": interview.id, "status": "generating", "creditsRemaining": consume["credits"]}


@router.get("/reports/status/{interview_id}")
async def report_status(interview_id: str, deviceId: str = Query(...)):
    device_id = security.require_device_id(deviceId)
    interview = await db.interviews.find_one({"_id": interview_id, "deviceId": device_id}, {"_id": 0, "deviceId": 0})
    if not interview:
        raise HTTPException(status_code=404, detail={"reason": "interview_not_found"})

    report = None
    if interview.get("status") == "ready" and interview.get("reportId"):
        report = await db.reports.find_one({"_id": interview["reportId"], "deviceId": device_id}, {"_id": 0, "deviceId": 0})

    return {
        "interviewId": interview_id,
        "status": interview.get("status", "generating"),
        "reportId": interview.get("reportId"),
        "report": report,
        "errorReason": interview.get("errorReason"),
        "errorMessage": interview.get("errorMessage"),
        "updatedAt": interview.get("updatedAt"),
    }


@router.get("/reports")
async def list_reports(deviceId: str = Query(...)):
    docs = await db.reports.find({"deviceId": deviceId}, {"_id": 0, "deviceId": 0}).sort("generatedAt", -1).to_list(100)
    return docs


@router.get("/reports/{report_id}")
async def get_report(report_id: str, deviceId: str = Query(...)):
    return await security.assert_report_owner(report_id, deviceId)
