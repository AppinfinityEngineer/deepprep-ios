"""Founder sale notifications for DeepPrep LiveOps.

Uses Pushover when PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY are configured.
Test notifications deliberately do not create LiveOps events or revenue.
"""
from __future__ import annotations

import asyncio
import urllib.parse
import urllib.request
from typing import Any, Dict

from ..config import get_settings

APP_TITLE = "ThoughtSnap Labs"
PRODUCT_TITLE = "DeepPrep"
APPLE_SMALL_BUSINESS_NET_MULTIPLIER = 0.85


def _settings_tokens() -> tuple[str, str]:
    settings = get_settings()
    app_token = getattr(settings, "pushover_app_token", "") or ""
    user_key = getattr(settings, "pushover_user_key", "") or ""
    return app_token.strip(), user_key.strip()


def _money(value: Any) -> str:
    try:
        return f"£{float(value):.2f}"
    except Exception:
        return "£0.00"


def _mask_device(device_id: Any) -> str:
    raw = str(device_id or "unknown")
    if len(raw) <= 10:
        return raw
    return f"{raw[:6]}...{raw[-4:]}"


def _plan_label(row: Dict[str, Any]) -> str:
    plan = str(row.get("plan") or row.get("planLabel") or "").strip()
    product_id = str(row.get("productId") or "")
    if plan:
        if "pro" in plan.lower():
            return plan
        return f"{plan.title()} Pro"
    if "annual" in product_id:
        return "Annual Pro"
    if "month" in product_id:
        return "Monthly Pro"
    if "lifetime" in product_id:
        return "Lifetime Pro"
    if "week" in product_id or "weekly" in product_id:
        return "Weekly Pro"
    return "DeepPrep Pro"


def _summary_cards(summary: Dict[str, Any] | None) -> Dict[str, Any]:
    if not summary:
        return {}
    cards = summary.get("cards")
    return cards if isinstance(cards, dict) else {}


def _sales_count(cards: Dict[str, Any], fallback: int = 0) -> int:
    for key in ("totalPurchases", "purchasesToday", "salesToday"):
        value = cards.get(key)
        if isinstance(value, dict):
            value = value.get("value")
        try:
            if value is not None:
                return int(value)
        except Exception:
            pass
    return fallback


def _sales_gross(cards: Dict[str, Any], fallback: float = 0.0) -> float:
    for key in ("grossRevenue", "grossRevenueToday", "todayGrossRevenue"):
        value = cards.get(key)
        if isinstance(value, dict):
            value = value.get("value")
        try:
            if value is not None:
                return float(value)
        except Exception:
            pass
    return fallback


def _build_sale_message(row: Dict[str, Any], summary: Dict[str, Any] | None = None, *, test_mode: bool = False) -> str:
    cards = _summary_cards(summary)
    plan = _plan_label(row)
    gross = float(row.get("gross") or row.get("grossGbp") or row.get("priceGbp") or 0.0)
    net = float(row.get("net") or row.get("netGbp") or round(gross * APPLE_SMALL_BUSINESS_NET_MULTIPLIER, 2))

    sales_today = int(row.get("salesToday") or _sales_count(cards, 1 if gross else 0))
    gross_today = float(row.get("grossToday") or _sales_gross(cards, gross))
    net_today = float(row.get("netToday") or round(gross_today * APPLE_SMALL_BUSINESS_NET_MULTIPLIER, 2))

    sales_launch = int(row.get("salesSinceLaunch") or _sales_count(cards, sales_today))
    gross_launch = float(row.get("grossSinceLaunch") or _sales_gross(cards, gross_today))
    net_launch = float(row.get("netSinceLaunch") or round(gross_launch * APPLE_SMALL_BUSINESS_NET_MULTIPLIER, 2))

    device = _mask_device(row.get("deviceId") or row.get("device") or row.get("maskedDeviceId"))

    test_block = "\n🧪 TEST MODE\nThis is not included in LiveOps sales funnel data.\n\n" if test_mode else ""

    return (
        f"🎉 {APP_TITLE}\n\n"
        f"💰 {PRODUCT_TITLE}\n\n"
        f"{test_block}"
        f"{plan} Sold ✅\n\n"
        "━━━━━━━━━━━━━━\n\n"
        f"Gross {_money(gross)}\n"
        f"Net {_money(net)}\n\n"
        "━━━━━━━━━━━━━━\n\n"
        "📈 Today\n"
        f"{sales_today} sales • {_money(gross_today)} gross • {_money(net_today)} net\n\n"
        "🚀 Since Launch\n"
        f"{sales_launch} sales • {_money(gross_launch)} gross • {_money(net_launch)} net\n\n"
        "━━━━━━━━━━━━━━\n\n"
        f"Device: {device}"
    )


def _post_pushover_sync(title: str, message: str) -> Dict[str, Any]:
    app_token, user_key = _settings_tokens()
    if not app_token or not user_key:
        return {"ok": False, "configured": False, "reason": "pushover_not_configured"}

    data = urllib.parse.urlencode({
        "token": app_token,
        "user": user_key,
        "title": title,
        "message": message,
        "priority": "0",
    }).encode("utf-8")

    request = urllib.request.Request(
        "https://api.pushover.net/1/messages.json",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {"ok": 200 <= response.status < 300, "configured": True, "status": response.status, "body": body[:500]}
    except Exception as exc:
        return {"ok": False, "configured": True, "reason": str(exc)}


async def send_pushover_message(title: str, message: str) -> Dict[str, Any]:
    return await asyncio.to_thread(_post_pushover_sync, title, message)


async def status() -> Dict[str, Any]:
    app_token, user_key = _settings_tokens()
    return {
        "ok": True,
        "service": "pushover",
        "brand": "DeepPrep",
        "configured": bool(app_token and user_key),
        "hasAppToken": bool(app_token),
        "hasUserKey": bool(user_key),
    }


async def get_status() -> Dict[str, Any]:
    return await status()


async def send_purchase_notification(row: Dict[str, Any], summary: Dict[str, Any] | None = None) -> Dict[str, Any]:
    message = _build_sale_message(row, summary, test_mode=False)
    return await send_pushover_message(APP_TITLE, message)


async def send_test_notification(summary: Dict[str, Any] | None = None) -> Dict[str, Any]:
    row = {
        "deviceId": "testmodeabcdef1234",
        "plan": "Weekly Pro",
        "productId": "deepprep_pro_weekly",
        "gross": 7.99,
        "net": round(7.99 * APPLE_SMALL_BUSINESS_NET_MULTIPLIER, 2),
        "source": "test",
    }
    message = _build_sale_message(row, summary, test_mode=True)
    result = await send_pushover_message(APP_TITLE, message)
    return {**result, "testMode": True, "pollutedFunnel": False}


# Compatibility aliases for route/service call-sites.
async def notify_purchase(row: Dict[str, Any], summary: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return await send_purchase_notification(row, summary)


async def notify_purchase_completed(row: Dict[str, Any], summary: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return await send_purchase_notification(row, summary)


async def send_founder_sale_notification(row: Dict[str, Any], summary: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return await send_purchase_notification(row, summary)
