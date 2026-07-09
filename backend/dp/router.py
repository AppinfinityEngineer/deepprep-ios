"""Aggregate all DeepPrep routers under a single APIRouter."""
from fastapi import APIRouter

from . import routes_health, routes_free_scan, routes_reports, routes_entitlement, routes_privacy, routes_dev, routes_live_ops, routes_admin_live_ops

deepprep_router = APIRouter()
deepprep_router.include_router(routes_health.router, tags=["health"])
deepprep_router.include_router(routes_free_scan.router, tags=["free-scan"])
deepprep_router.include_router(routes_reports.router, tags=["reports"])
deepprep_router.include_router(routes_entitlement.router, tags=["entitlement"])
deepprep_router.include_router(routes_privacy.router, tags=["privacy"])
deepprep_router.include_router(routes_dev.router, tags=["dev"])
deepprep_router.include_router(routes_live_ops.router, tags=["live-ops-events"])
deepprep_router.include_router(routes_admin_live_ops.router, tags=["admin-live-ops"])
