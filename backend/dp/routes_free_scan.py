from fastapi import APIRouter, Request, HTTPException
from .models import FreeScanEligibilityIn, FreeScanCreateIn
from .services import free_scan_service
from .services.llm_provider import LLMConfigError
from .services.search_provider import SearchConfigError, SearchProviderError
from . import db

router = APIRouter(prefix="/free-scan")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/eligibility")
async def eligibility(body: FreeScanEligibilityIn, request: Request):
    return await free_scan_service.check_eligibility(
        body.deviceId, _client_ip(request), body.userAgent or request.headers.get("user-agent"), body.attestToken
    )


@router.post("/create")
async def create(body: FreeScanCreateIn, request: Request):
    try:
        report = await free_scan_service.create_free_scan(
            body.deviceId,
            body.company,
            body.role,
            body.jdText,
            body.date,
            body.interviewers,
            body.profileUrl,
            body.profileText,
            _client_ip(request),
            body.userAgent or request.headers.get("user-agent"),
            body.attestToken,
        )
    except free_scan_service.FreeScanError as e:
        raise HTTPException(status_code=403, detail={"message": e.message, "reason": e.reason, "freeScanReportId": e.report_id})
    except SearchConfigError as e:
        # Do not mark free scan as used when search is not configured.
        raise HTTPException(status_code=503, detail={"message": str(e), "reason": "search_not_configured"})
    except SearchProviderError as e:
        raise HTTPException(status_code=503, detail={"message": str(e), "reason": "search_provider_failed"})
    except LLMConfigError as e:
        # Do not mark free scan as used when synthesis is not configured.
        raise HTTPException(status_code=503, detail={"message": str(e), "reason": "llm_not_configured"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"message": str(e), "reason": "generation_failed"})
    return report.model_dump()


@router.get("/{report_id}")
async def get_free_scan(report_id: str):
    # Branch 6 will device-protect this read. For Branch 2, keep behaviour stable.
    doc = await db.reports.find_one({"_id": report_id}, {"_id": 0, "deviceId": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Free scan not found")
    return doc
