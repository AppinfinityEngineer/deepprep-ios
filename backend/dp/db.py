"""MongoDB access layer for DeepPrep.

Collections:
  devices        — anonymous device / free-scan protection records
  interviews     — user-created interviews (drafts + briefs)
  reports        — generated intelligence reports (free_scan + full)
  entitlements   — subscription / credit state (server-authoritative)
  usage          — per-device usage + spend counters
  cost_events    — cost tracking audit log
"""
from motor.motor_asyncio import AsyncIOMotorClient

from .config import get_settings

_settings = get_settings()
_client = AsyncIOMotorClient(_settings.mongo_url)
db = _client[_settings.db_name]

devices = db["devices"]
interviews = db["interviews"]
reports = db["reports"]
entitlements = db["entitlements"]
usage = db["usage"]
cost_events = db["cost_events"]


def close() -> None:
    _client.close()
