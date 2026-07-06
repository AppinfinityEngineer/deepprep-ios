from fastapi import APIRouter, HTTPException, Query
from .models import ReportCreateIn, Interview, Interviewer
from .services import report_service, entitlement_service
from .services.llm_provider import LLMConfigError
from . import db
from .utils import now_iso

router = APIRouter()


@router.post("/reports")
async def create_report(body: ReportCreateIn):
    # Server-authoritative entitlement + credit check.
    cost = entitlement_service.credit_cost(len(body.interviewers), kind="brief")
    consume = await entitlement_service.consume_credits(body.deviceId, cost)
    if not consume["ok"]:
        raise HTTPException(status_code=402, detail={"reason": consume["reason"], "credits": consume["credits"]})

    interview = Interview(
        company=body.company, role=body.role, jdText=body.jdText, date=body.date,
        interviewers=[Interviewer(**iv.model_dump()) for iv in body.interviewers],
        status="generating",
    )
    await db.interviews.update_one({"_id": interview.id}, {"$set": {**interview.model_dump(), "deviceId": body.deviceId}}, upsert=True)

    try:
        report = await report_service.build_full_report(
            interview.id, body.company, body.role, body.jdText, body.date, body.interviewers
        )
    except LLMConfigError as e:
        # Refund the credit — generation never happened.
        ent = await entitlement_service.get_entitlement(body.deviceId)
        ent["credits"] = ent.get("credits", 0) + cost
        await db.entitlements.update_one({"_id": body.deviceId}, {"$set": ent})
        await db.interviews.update_one({"_id": interview.id}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=503, detail={"reason": "llm_not_configured", "message": str(e)})
    except Exception as e:
        ent = await entitlement_service.get_entitlement(body.deviceId)
        ent["credits"] = ent.get("credits", 0) + cost
        await db.entitlements.update_one({"_id": body.deviceId}, {"$set": ent})
        await db.interviews.update_one({"_id": interview.id}, {"$set": {"status": "failed"}})
        raise HTTPException(status_code=500, detail={"reason": "generation_failed", "message": str(e)})

    await db.reports.update_one({"_id": report.id}, {"$set": {**report.model_dump(), "deviceId": body.deviceId}}, upsert=True)
    await db.interviews.update_one({"_id": interview.id}, {"$set": {"reportId": report.id, "status": "ready", "updatedAt": now_iso()}})
    return {"report": report.model_dump(), "creditsRemaining": consume["credits"]}


@router.get("/reports")
async def list_reports(deviceId: str = Query(...)):
    docs = await db.reports.find({"deviceId": deviceId}, {"_id": 0, "deviceId": 0}).sort("generatedAt", -1).to_list(100)
    return docs


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    doc = await db.reports.find_one({"_id": report_id}, {"_id": 0, "deviceId": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return doc
