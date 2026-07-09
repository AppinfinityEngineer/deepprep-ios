"""Public, anonymous LiveOps event ingestion for DeepPrep."""
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .services import live_ops_service

router = APIRouter(prefix="/live-ops")

class LiveOpsEventIn(BaseModel):
    deviceId: str = Field(min_length=1, max_length=160)
    eventType: str
    source: Optional[str] = "app"
    metadata: Dict[str, Any] = Field(default_factory=dict)

@router.post("/event")
async def live_ops_event(body: LiveOpsEventIn):
    try:
        event = await live_ops_service.record_event(event_type=body.eventType, device_id=body.deviceId, source=body.source or "app", metadata=body.metadata, notify_purchase=True)
        return {"ok": True, "event": event}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
