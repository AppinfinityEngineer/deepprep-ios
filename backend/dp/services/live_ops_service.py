"""DeepPrep LiveOps funnel, revenue, VAP and purchase dedupe service."""
from __future__ import annotations

import hashlib
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from .. import db
from ..utils import new_id, now_iso

APP_NAME = "DeepPrep"
BRAND_NAME = "ThoughtSnap Labs"
LAUNCH_DATE_ISO = "2026-07-09T00:00:00+00:00"
APPLE_SMALL_BUSINESS_COMMISSION = 0.15
NET_MULTIPLIER = 1.0 - APPLE_SMALL_BUSINESS_COMMISSION
LIVE_WINDOW_MINUTES = 30
EVENT_TYPES = {"onboarding_started","onboarding_step_completed","onboarding_completed","prep_profile_generated","preview_viewed","paywall_viewed","annual_selected","monthly_selected","lifetime_selected","weekly_selected","purchase_started","purchase_completed","purchase_failed","restore_success"}
VAP_WEIGHTS = {"onboarding_completed":1,"prep_profile_generated":2,"preview_viewed":2,"paywall_viewed":1,"annual_selected":2,"monthly_selected":2,"weekly_selected":2,"lifetime_selected":3,"purchase_started":5,"purchase_completed":20,"restore_success":8}
PRODUCTS = {"deepprep_pro_weekly":{"plan":"weekly","label":"Weekly Pro","gross":7.99},"deepprep_pro_monthly":{"plan":"monthly","label":"Monthly Pro","gross":0.0},"deepprep_pro_annual":{"plan":"annual","label":"Annual Pro","gross":0.0},"deepprep_pro_lifetime":{"plan":"lifetime","label":"Lifetime","gross":0.0}}

def parse_iso(value: str | None) -> datetime:
    if not value: return datetime.now(timezone.utc)
    try: return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception: return datetime.now(timezone.utc)

def mask_device(device_id: str | None) -> str:
    if not device_id: return "unknown"
    if len(device_id) <= 10: return device_id[:3] + "..." + device_id[-2:]
    return f"{device_id[:6]}...{device_id[-4:]}"

def short_device_hash(device_id: str | None) -> str:
    return hashlib.sha256((device_id or "unknown").encode("utf-8")).hexdigest()[:12]

def plan_info(product_id: str | None, plan: str | None = None, gross: float | None = None) -> Dict[str, Any]:
    product_id = product_id or "deepprep_pro_weekly"
    base = dict(PRODUCTS.get(product_id, {"plan": (plan or "weekly"), "label": f"{(plan or 'weekly').title()} Pro", "gross": 0.0}))
    if plan:
        p = plan.strip().lower(); base["plan"] = p
        base["label"] = "Weekly Pro" if p == "weekly" else "Monthly Pro" if p == "monthly" else "Annual Pro" if p == "annual" else "Lifetime" if p == "lifetime" else f"{p.title()} Pro"
    if gross is not None:
        try: base["gross"] = float(gross)
        except Exception: pass
    return base

def net_amount(gross: float) -> float: return round(float(gross or 0.0) * NET_MULTIPLIER, 2)
def created_minute(created_at: str | None) -> str: return parse_iso(created_at).strftime("%Y-%m-%dT%H:%M")

def purchase_dedupe_key(event: Dict[str, Any]) -> str:
    m = event.get("metadata") or {}; tx = m.get("transactionId") or event.get("transactionId")
    device_id = event.get("deviceId") or m.get("deviceId") or "unknown"; product_id = m.get("productId") or event.get("productId") or "unknown_product"; plan = m.get("plan") or event.get("plan") or "unknown_plan"
    if tx: return f"txn:{tx}"
    if device_id and product_id and event.get("createdAt"): return f"minute:{device_id}:{product_id}:{created_minute(event.get('createdAt'))}"
    return f"fallback:{device_id}:{product_id}:{plan}"

def dedupe_purchases(events: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    winners: Dict[str, Dict[str, Any]] = {}
    for e in events:
        if e.get("eventType") != "purchase_completed": continue
        key = purchase_dedupe_key(e)
        if key not in winners or parse_iso(e.get("createdAt")) < parse_iso(winners[key].get("createdAt")): winners[key] = e
    return sorted(winners.values(), key=lambda item: item.get("createdAt", ""), reverse=True)

def sanitize_metadata(metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(metadata, dict): return {}
    out: Dict[str, Any] = {}
    for k,v in metadata.items():
        if k in {"name","email","phone","address"}: continue
        if isinstance(v,(str,int,float,bool)) or v is None: out[k]=v
        elif isinstance(v,list): out[k]=[x for x in v if isinstance(x,(str,int,float,bool))][:20]
        elif isinstance(v,dict): out[k]={kk:vv for kk,vv in v.items() if isinstance(vv,(str,int,float,bool))}
    return out

async def record_event(*, event_type: str, device_id: str, source: str = "app", metadata: Optional[Dict[str, Any]] = None, notify_purchase: bool = True) -> Dict[str, Any]:
    if event_type not in EVENT_TYPES: raise ValueError(f"Unsupported LiveOps event type: {event_type}")
    device_id = (device_id or "anonymous").strip()[:160] or "anonymous"
    doc = {"_id": new_id(), "eventType": event_type, "deviceId": device_id, "deviceHash": short_device_hash(device_id), "source": source or "app", "metadata": sanitize_metadata(metadata), "createdAt": now_iso()}
    await db.live_ops_events.insert_one(doc)
    if event_type == "purchase_completed" and notify_purchase:
        from .founder_notifications import notify_purchase_completed
        await notify_purchase_completed(doc)
    return {k:v for k,v in doc.items() if k != "_id"}

async def record_purchase_from_entitlement(*, device_id: str, product_id: str, receipt: Any = None, source: str = "entitlement_sync", dev_mock: bool = False) -> Dict[str, Any]:
    meta: Dict[str, Any] = {"productId": product_id, "plan": plan_info(product_id).get("plan"), "source": source, "gross": 0.0 if dev_mock else plan_info(product_id).get("gross",0.0)}
    if isinstance(receipt, str) and receipt:
        try:
            import json
            parsed = json.loads(receipt)
            if isinstance(parsed, dict):
                for key in ("transactionId","originalTransactionIdentifierIOS","productId","source"):
                    if parsed.get(key): meta[key] = parsed.get(key)
                if parsed.get("source") == "restore": source = "restore"
        except Exception: meta["receiptPresent"] = True
    event_type = "restore_success" if source == "restore" else "purchase_completed"
    return await record_event(event_type=event_type, device_id=device_id, source=source, metadata=meta, notify_purchase=(event_type == "purchase_completed" and not dev_mock))

async def all_events_since_launch() -> List[Dict[str, Any]]:
    return await db.live_ops_events.find({"createdAt":{"$gte":LAUNCH_DATE_ISO}}, {"_id":0}).sort("createdAt", -1).to_list(5000)

def safe_rate(n:int,d:int)->float: return 0.0 if d<=0 else round((n/d)*100.0,1)
def vap(events: Iterable[Dict[str, Any]]) -> int: return sum(VAP_WEIGHTS.get(e.get("eventType"),0) for e in events)

def purchase_row(event: Dict[str, Any]) -> Dict[str, Any]:
    m = event.get("metadata") or {}; product_id = m.get("productId") or event.get("productId") or "deepprep_pro_weekly"; info = plan_info(product_id, m.get("plan"), m.get("gross")); gross=round(float(info.get("gross") or 0.0),2)
    return {"time":event.get("createdAt"),"maskedDeviceId":mask_device(event.get("deviceId")),"plan":info.get("plan"),"planLabel":info.get("label"),"productId":product_id,"gross":gross,"net":net_amount(gross),"source":m.get("source") or event.get("source") or "app","dedupeKey":purchase_dedupe_key(event)}

async def funnel_summary() -> Dict[str, Any]:
    events = await all_events_since_launch(); now=datetime.now(timezone.utc); today_start=now.replace(hour=0,minute=0,second=0,microsecond=0); live_since=now-timedelta(minutes=LIVE_WINDOW_MINUTES)
    today_events=[e for e in events if parse_iso(e.get("createdAt"))>=today_start]; live_events=[e for e in events if parse_iso(e.get("createdAt"))>=live_since]
    purchases=dedupe_purchases(events); today_purchases=[p for p in purchases if parse_iso(p.get("createdAt"))>=today_start]
    rows=[purchase_row(p) for p in purchases]; today_rows=[purchase_row(p) for p in today_purchases]
    counts=Counter(e.get("eventType") for e in events); plan_counts=Counter(r["plan"] for r in rows)
    gross=round(sum(r["gross"] for r in rows),2); net=round(sum(r["net"] for r in rows),2); tg=round(sum(r["gross"] for r in today_rows),2); tn=round(sum(r["net"] for r in today_rows),2)
    os=counts.get("onboarding_started",0); oc=counts.get("onboarding_completed",0); pv=counts.get("paywall_viewed",0); tp=len(purchases)
    funnel=[("Onboarding Started","onboarding_started",os),("Onboarding Completed","onboarding_completed",oc),("Prep Profile Generated","prep_profile_generated",counts.get("prep_profile_generated",0)),("Preview Viewed","preview_viewed",counts.get("preview_viewed",0)),("Paywall Viewed","paywall_viewed",pv),("Purchase Started","purchase_started",counts.get("purchase_started",0)),("Purchase Completed","purchase_completed",tp)]
    return {"ok":True,"app":APP_NAME,"brand":BRAND_NAME,"generatedAt":now_iso(),"launchDate":LAUNCH_DATE_ISO,"refreshSeconds":15,"commission":{"appleSmallBusiness":APPLE_SMALL_BUSINESS_COMMISSION,"netMultiplier":NET_MULTIPLIER},"cards":{"onboardingStarted":os,"onboardingCompletionRate":safe_rate(oc,os),"paywallConversionRate":safe_rate(tp,pv),"weeklySales":plan_counts.get("weekly",0),"annualSales":plan_counts.get("annual",0),"monthlySales":plan_counts.get("monthly",0),"lifetimeSales":plan_counts.get("lifetime",0),"grossRevenue":gross,"netRevenue":net,"liveEvents30m":len(live_events),"globalVapToday":vap(today_events),"globalVapSinceLaunch":vap(events),"totalPurchases":tp,"lastPurchaseTime":rows[0]["time"] if rows else None,"todaySales":len(today_purchases),"todayGross":tg,"todayNet":tn},"counts":dict(counts),"conversionFunnel":[{"label":a,"eventType":b,"count":c} for a,b,c in funnel],"purchaseHistory":rows[:100],"recentEvents":[{"time":e.get("createdAt"),"eventType":e.get("eventType"),"maskedDeviceId":mask_device(e.get("deviceId")),"source":e.get("source"),"metadata":e.get("metadata") or {},"vap":VAP_WEIGHTS.get(e.get("eventType"),0)} for e in events[:100]]}

async def reset_funnel() -> Dict[str, Any]:
    doc={"_id":new_id(),"eventType":"live_ops_reset_marker","deviceId":"admin","deviceHash":"admin","source":"admin","metadata":{"note":"Logical reset marker only. Raw events were not deleted."},"createdAt":now_iso()}
    await db.live_ops_events.insert_one(doc)
    return {"ok":True,"message":"Reset marker recorded. Raw events remain untouched.","createdAt":doc["createdAt"]}
