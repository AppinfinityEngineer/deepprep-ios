# DeepPrep — Interview Prep AI (ThoughtSnap Labs)

Premium, iOS-first interview-intelligence app. Enter a company, role, interview
date and interviewers; DeepPrep researches public professional signals and
generates an interview brief: interviewer dossiers, company signals, likely
questions, smart talking points, and a day-of brief — with honest
confidence/freshness notes.

- **Frontend:** React Native + TypeScript + Expo + Expo Router
- **Backend:** FastAPI + MongoDB (`/app/backend`)
- **AI:** OpenAI / Anthropic synthesis (configurable), Tavily search (stubbed)

---

## Running locally

### Backend
```
cd backend
cp .env.example .env      # fill in keys (or keep mock flags for dev)
/root/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Health check: `GET /api/health`.

**Mock vs live:**
- `ENABLE_MOCK_SEARCH=true` — no Tavily key needed (dev). Set `false` + add
  `TAVILY_API_KEY` for live web search (branch-1).
- `ENABLE_MOCK_LLM` — `false` uses real synthesis via `OPENAI_API_KEY` /
  `ANTHROPIC_API_KEY` (or the Emergent universal key). `true` returns dev
  fixtures ONLY (never used as production facts).
- Provider/model: `LLM_PROVIDER`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`.

> This build currently runs with `ENABLE_MOCK_LLM=true` because the shared
> Emergent universal key balance was exhausted. Add balance (Profile → Universal
> Key) **or** set your own `OPENAI_API_KEY`, then set `ENABLE_MOCK_LLM=false`.

### Frontend
Served by Expo (Metro) on port 3000. The app reads `EXPO_PUBLIC_BACKEND_URL`
and calls `${EXPO_PUBLIC_BACKEND_URL}/api/...`.

---

## API
```
GET  /api/health
POST /api/free-scan/eligibility
POST /api/free-scan/create
GET  /api/free-scan/{id}
POST /api/reports
GET  /api/reports?deviceId=...
GET  /api/reports/{id}
POST /api/entitlement/sync
GET  /api/entitlement?deviceId=...
GET  /api/usage?deviceId=...
POST /api/privacy/delete
```

## Pipeline
`company_resolver → person_discovery → candidate_ranker (deterministic scoring)
→ freshness → llm_provider (synthesis) → report_service`. Identity confidence
and current-role freshness are scored separately. Costs tracked per report.

## Abuse protection (free scan)
Server-authoritative per-device record (`freeScanUsed`), anonymous device id
persisted in the iOS Keychain (survives reinstall), global daily cap, IP/UA
hashes, and an App Attest/DeviceCheck token slot (verification stubbed).

## Entitlement / StoreKit
Server-authoritative. Product `deepprep_pro_weekly`, entitlement `deepprep_pro`,
£1.99/3 days then £7.99/week. Purchase + restore are stubbed with a dev-only
mock unlock (`src/storekit/StoreKitService.ts`, `DEV_MOCK_UNLOCK`). Credit rules
in `entitlement_service.py` (standard brief = 1 credit, panel 3–4 = 2, day-of =
free, profile refresh = free).

## Branch plan (TODOs left in code)
1. Wire Tavily search · 2. Real OpenAI/Anthropic keys · 3. Mongo indexes/scale ·
4. App Store Server API entitlement · 5. Real StoreKit/RevenueCat ·
6. DeviceCheck/App Attest · 7. Production privacy/terms · 8. Notifications +
TestFlight polish · 9. App Store metadata · 10. Production caps/admin.
