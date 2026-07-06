from fastapi import APIRouter, Query
from .models import EntitlementSyncIn
from .services import entitlement_service

router = APIRouter()


@router.post("/entitlement/sync")
async def entitlement_sync(body: EntitlementSyncIn):
    ent = await entitlement_service.sync(body.deviceId, body.receipt, body.productId, body.devMockUnlock)
    return {
        "active": ent.get("active", False),
        "entitlementId": ent.get("entitlementId"),
        "productId": ent.get("productId"),
        "creditsRemaining": ent.get("credits", 0),
        "introUsed": ent.get("introUsed", False),
    }


@router.get("/entitlement")
async def entitlement_get(deviceId: str = Query(...)):
    ent = await entitlement_service.get_entitlement(deviceId)
    return {
        "active": ent.get("active", False),
        "entitlementId": ent.get("entitlementId"),
        "productId": ent.get("productId"),
        "creditsRemaining": ent.get("credits", 0),
        "introUsed": ent.get("introUsed", False),
    }


@router.get("/usage")
async def usage(deviceId: str = Query(...)):
    return await entitlement_service.get_usage(deviceId)
