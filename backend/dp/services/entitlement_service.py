"""Server-authoritative entitlement + credit accounting.

Native StoreKit purchases are synced by the client through `/entitlement/sync`,
but the backend remains authoritative for credits and access. Branch 7 accepts
StoreKit receipt/transaction payloads in development/TestFlight validation mode;
production Apple server validation is intentionally isolated for the next release
hardening branch.
"""
from typing import Dict
from fastapi import HTTPException

from .. import db
from ..config import get_settings
from ..utils import now_iso, week_key

ENTITLEMENT_ID = "deepprep_pro"
PRODUCT_ID = "deepprep_pro_weekly"
INTRO_CREDITS = 1
WEEKLY_CREDITS = 6


def _validate_product(product_id: str | None) -> str:
    if product_id != PRODUCT_ID:
        raise HTTPException(status_code=400, detail={"reason": "invalid_product", "productId": product_id})
    return PRODUCT_ID


async def get_entitlement(device_id: str) -> Dict:
    doc = await db.entitlements.find_one({"_id": device_id}, {"_id": 0})
    if not doc:
        doc = {"deviceId": device_id, "entitlementId": ENTITLEMENT_ID, "active": False, "productId": None, "introUsed": False, "credits": 0, "renewsAt": None, "updatedAt": now_iso()}
        await db.entitlements.update_one({"_id": device_id}, {"$set": doc}, upsert=True)
    return doc


async def sync(device_id: str, receipt, product_id, dev_mock_unlock: bool) -> Dict:
    settings = get_settings()
    ent = await get_entitlement(device_id)
    valid_product_id = _validate_product(product_id)
    is_production = settings.app_env == "production"
    dev_unlock_allowed = settings.allow_dev_mock_unlock and bool(dev_mock_unlock)
    receipt_verified_for_validation_lane = bool(receipt) and not is_production
    active = receipt_verified_for_validation_lane or dev_unlock_allowed
    if not active:
        ent["active"] = False
        ent["productId"] = valid_product_id
        ent["updatedAt"] = now_iso()
        await db.entitlements.update_one({"_id": device_id}, {"$set": ent}, upsert=True)
        return ent
    current_week = week_key()
    already_active = bool(ent.get("active"))
    same_week = ent.get("renewsAt") == current_week
    if not already_active:
        ent["credits"] = max(ent.get("credits", 0), INTRO_CREDITS + WEEKLY_CREDITS)
        ent["introUsed"] = True
        ent["renewsAt"] = current_week
    elif not same_week:
        ent["credits"] = max(ent.get("credits", 0), WEEKLY_CREDITS)
        ent["renewsAt"] = current_week
    ent["active"] = True
    ent["entitlementId"] = ENTITLEMENT_ID
    ent["productId"] = valid_product_id
    ent["lastReceiptSyncedAt"] = now_iso() if receipt else ent.get("lastReceiptSyncedAt")
    ent["updatedAt"] = now_iso()
    await db.entitlements.update_one({"_id": device_id}, {"$set": ent}, upsert=True)
    try:
        from .live_ops_service import record_purchase_from_entitlement
        await record_purchase_from_entitlement(device_id=device_id, product_id=valid_product_id, receipt=receipt, source="entitlement_sync", dev_mock=dev_unlock_allowed)
    except Exception:
        pass
    return ent


def credit_cost(interviewer_count: int, kind: str = "brief") -> int:
    if kind == "day_of": return 0
    if kind == "profile_refresh": return 0
    if kind == "regenerate": return 1
    return 2 if interviewer_count >= 3 else 1


async def consume_credits(device_id: str, cost: int, spend_gbp: float = 0.0) -> Dict:
    """Returns {ok, reason?, credits}. Enforces credits + daily/weekly caps."""
    settings = get_settings()
    ent = await get_entitlement(device_id)
    if not ent.get("active"):
        return {"ok": False, "reason": "no_active_subscription", "credits": ent.get("credits", 0)}
    if cost > 0 and ent.get("credits", 0) < cost:
        return {"ok": False, "reason": "insufficient_credits", "credits": ent.get("credits", 0)}
    u = await _usage_doc(device_id)
    if u["daily"]["credits"] + cost > settings.max_daily_credits_per_user:
        return {"ok": False, "reason": "daily_credit_cap", "credits": ent.get("credits", 0)}
    if u["weekly"]["credits"] + cost > settings.max_weekly_credits_per_user:
        return {"ok": False, "reason": "weekly_credit_cap", "credits": ent.get("credits", 0)}
    ent["credits"] = ent.get("credits", 0) - cost
    ent["updatedAt"] = now_iso()
    await db.entitlements.update_one({"_id": device_id}, {"$set": ent}, upsert=True)
    await _bump_usage(device_id, cost, spend_gbp)
    return {"ok": True, "credits": ent["credits"]}


async def _usage_doc(device_id: str) -> Dict:
    doc = await db.usage.find_one({"_id": device_id}, {"_id": 0})
    from ..utils import today_key
    tk, wk = today_key(), week_key()
    if not doc or doc.get("daily", {}).get("key") != tk:
        doc = doc or {}; doc["daily"] = {"key": tk, "credits": 0, "spendGbp": 0.0}
    if not doc.get("weekly") or doc["weekly"].get("key") != wk:
        doc["weekly"] = {"key": wk, "credits": 0, "spendGbp": 0.0}
    return doc


async def _bump_usage(device_id: str, cost: int, spend_gbp: float) -> None:
    doc = await _usage_doc(device_id)
    doc["daily"]["credits"] += cost
    doc["daily"]["spendGbp"] = round(doc["daily"]["spendGbp"] + spend_gbp, 4)
    doc["weekly"]["credits"] += cost
    doc["weekly"]["spendGbp"] = round(doc["weekly"]["spendGbp"] + spend_gbp, 4)
    doc["deviceId"] = device_id
    doc["updatedAt"] = now_iso()
    await db.usage.update_one({"_id": device_id}, {"$set": doc}, upsert=True)


async def get_usage(device_id: str) -> Dict:
    ent = await get_entitlement(device_id)
    u = await _usage_doc(device_id)
    return {"deviceId": device_id, "active": ent.get("active", False), "entitlementId": ENTITLEMENT_ID, "creditsRemaining": ent.get("credits", 0), "introUsed": ent.get("introUsed", False), "daily": u["daily"], "weekly": u["weekly"]}
