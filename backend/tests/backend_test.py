"""DeepPrep backend regression tests.

Runs against the public preview URL (EXPO_PUBLIC_BACKEND_URL) so we exercise
exactly what the mobile app talks to.
"""
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def _device() -> str:
    return f"TEST_{uuid.uuid4().hex[:16]}"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Health ----------------
class TestHealth:
    def test_health(self, session):
        r = session.get(f"{API}/health", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "ok"
        assert data["mock_llm"] is True
        assert data["mock_search"] is True


# ---------------- Free scan ----------------
class TestFreeScan:
    def test_eligibility_fresh_device(self, session):
        did = _device()
        r = session.post(f"{API}/free-scan/eligibility", json={"deviceId": did}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["eligible"] is True

    def test_create_and_second_call_blocked(self, session):
        did = _device()
        payload = {
            "deviceId": did,
            "company": "Stripe",
            "role": "Senior Product Manager",
            "jdText": "Own the payments checkout roadmap.",
            "date": "2026-02-01",
            "interviewers": [{"name": "Alex Rivera", "title": "Director of PM"}],
        }
        r = session.post(f"{API}/free-scan/create", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        report = r.json()
        assert report["mode"] == "free_scan"
        assert report["company"] == "Stripe"
        fss = report.get("freeScanSummary")
        assert fss is not None, "freeScanSummary missing"
        assert isinstance(fss["matchConfidence"], int)
        assert 0 <= fss["matchConfidence"] <= 100
        assert isinstance(fss["keyInsights"], list) and len(fss["keyInsights"]) >= 3
        assert fss["likelyQuestion"]
        assert fss["talkingPoint"]

        # Second call must be blocked (abuse protection).
        r2 = session.post(f"{API}/free-scan/create", json=payload, timeout=30)
        assert r2.status_code == 403, r2.text
        detail = r2.json()["detail"]
        assert detail["reason"] == "already_used"


# ---------------- Entitlement + full report ----------------
class TestFullReportFlow:
    def _sync_pro(self, session, device_id: str):
        r = session.post(
            f"{API}/entitlement/sync",
            json={"deviceId": device_id, "devMockUnlock": True, "productId": "deepprep_pro_weekly"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_entitlement_sync_dev_mock_unlock(self, session):
        did = _device()
        data = self._sync_pro(session, did)
        assert data["active"] is True
        assert data["creditsRemaining"] > 0
        assert data["productId"] == "deepprep_pro_weekly"

    def test_report_without_subscription_returns_402(self, session):
        did = _device()
        payload = {
            "deviceId": did,
            "company": "Airbnb",
            "role": "Staff Engineer",
            "interviewers": [{"name": "Priya Shah"}],
        }
        r = session.post(f"{API}/reports", json=payload, timeout=30)
        assert r.status_code == 402, r.text
        assert r.json()["detail"]["reason"] == "no_active_subscription"

    def test_full_report_generation_and_credit_decrement(self, session):
        did = _device()
        self._sync_pro(session, did)
        # Standard brief with 2 interviewers -> 1 credit.
        payload = {
            "deviceId": did,
            "company": "Notion",
            "role": "Group PM",
            "jdText": "Own AI features roadmap.",
            "date": "2026-02-14",
            "interviewers": [
                {"name": "Jordan Lee", "title": "VP Product"},
                {"name": "Sam Ortiz", "title": "Head of Design"},
            ],
        }
        before = session.get(f"{API}/usage", params={"deviceId": did}, timeout=15).json()
        r = session.post(f"{API}/reports", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        report = body["report"]
        assert report["mode"] == "full"
        assert report["executiveSummary"]
        assert report["companyBrief"]["summary"]
        assert len(report["dossiers"]) == 2
        for d in report["dossiers"]:
            assert d["matchConfidence"]
            assert d["roleFreshness"]
        assert len(report["likelyQuestions"]) >= 1
        assert len(report["talkingPoints"]) >= 1
        assert report["dayOfBrief"]
        assert body["creditsRemaining"] == before["creditsRemaining"] - 1

        # List + get by id.
        listed = session.get(f"{API}/reports", params={"deviceId": did}, timeout=15).json()
        assert isinstance(listed, list) and any(x["id"] == report["id"] for x in listed)
        one = session.get(f"{API}/reports/{report['id']}", timeout=15)
        assert one.status_code == 200
        assert one.json()["id"] == report["id"]

    def test_panel_brief_costs_2_credits(self, session):
        did = _device()
        self._sync_pro(session, did)
        before = session.get(f"{API}/usage", params={"deviceId": did}, timeout=15).json()
        payload = {
            "deviceId": did,
            "company": "Databricks",
            "role": "Director of Data Platform",
            "interviewers": [
                {"name": "A"}, {"name": "B"}, {"name": "C"},
            ],
        }
        r = session.post(f"{API}/reports", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["creditsRemaining"] == before["creditsRemaining"] - 2

    def test_usage_endpoint(self, session):
        did = _device()
        self._sync_pro(session, did)
        r = session.get(f"{API}/usage", params={"deviceId": did}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["active"] is True
        assert data["creditsRemaining"] > 0


# ---------------- Privacy ----------------
class TestPrivacy:
    def test_privacy_delete_removes_reports(self, session):
        did = _device()
        # Give them an active sub and generate a report.
        session.post(
            f"{API}/entitlement/sync",
            json={"deviceId": did, "devMockUnlock": True, "productId": "deepprep_pro_weekly"},
            timeout=15,
        )
        session.post(
            f"{API}/reports",
            json={
                "deviceId": did,
                "company": "Meta",
                "role": "PM",
                "interviewers": [{"name": "X"}],
            },
            timeout=90,
        )
        listed_before = session.get(f"{API}/reports", params={"deviceId": did}, timeout=15).json()
        assert len(listed_before) >= 1

        r = session.post(f"{API}/privacy/delete", json={"deviceId": did}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["deleted"] is True
        assert body["reportsDeleted"] >= 1

        listed_after = session.get(f"{API}/reports", params={"deviceId": did}, timeout=15).json()
        assert listed_after == []
