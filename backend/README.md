
# DeepPrep Backend

FastAPI backend for DeepPrep. Entrypoint: `server.py`, with routes mounted under `/api`.

## Structure

```text
dp/
  config.py                 env + caps
  db.py                     Motor/Mongo collections
  models.py                 Pydantic schemas
  router.py                 API router aggregation
  routes_*.py               health/free-scan/reports/entitlement/privacy
  services/
    search_provider.py      Tavily/live search or explicit dev mock
    company_resolver.py     company context
    person_discovery.py     interviewer discovery query pack
    candidate_ranker.py     deterministic person scoring
    freshness.py            current-role freshness scoring
    source_classifier.py    source/domain classification
    cost_tracker.py         estimated cost model
    llm_provider.py         synthesis provider wrapper
    entitlement_service.py  credits/entitlement state
    free_scan_service.py    free scan eligibility + abuse controls
    report_service.py       pipeline orchestration
```

## Run locally

```bash
cd backend
cp .env.example .env
python -m venv .venv
# Windows: .\.venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -c "import server; print('server imports OK')"
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

```bash
curl http://localhost:8001/api/health
```

## Environment

See `backend/.env.example`.

For local development, `MONGO_URL` defaults to `mongodb://localhost:27017` when `APP_ENV` is not production. In production, set `MONGO_URL` explicitly.

## Mock/live policy

Mock mode is for development only and must be explicit:

```env
ENABLE_MOCK_SEARCH=true
ENABLE_MOCK_LLM=true
```

Live mode requires keys:

```env
ENABLE_MOCK_SEARCH=false
ENABLE_MOCK_LLM=false
TAVILY_API_KEY=...
OPENAI_API_KEY=...       # or ANTHROPIC_API_KEY
```

If mock mode is off and keys are missing, endpoints should fail clearly with a configuration error. They should not silently return fake user-facing reports.

## Native StoreKit only

DeepPrep uses the ThoughtSnap Labs native StoreKit pattern. Do not add RevenueCat.

Product ID: `deepprep_pro_weekly`  
Entitlement: `deepprep_pro`

The backend is the authority for:

- active entitlement
- intro credit
- weekly credits
- usage counters
- free scan eligibility
- report generation permission

## Test commands

```bash
python -m py_compile server.py dp/*.py dp/services/*.py
pytest
```

## Branch 4 live Tavily proof

Render/dev env for live search with mock synthesis:

```env
APP_ENV=development
MONGO_URL=<Atlas URL>
TAVILY_API_KEY=<Tavily key>
ENABLE_MOCK_SEARCH=false
ENABLE_MOCK_LLM=true
ALLOW_DEV_MOCK_UNLOCK=true
```

Health proof:

```bash
curl.exe https://deepprep-ios-dev.onrender.com/api/health
```

Free scan proof with a disposable device id:

```bash
curl.exe -X POST https://deepprep-ios-dev.onrender.com/api/free-scan/create ^
  -H "Content-Type: application/json" ^
  -d "{"deviceId":"branch4-nick-sharp-001","company":"Confused.com","role":"Senior Data Engineer","interviewers":[{"name":"Nick Sharp","title":"Director of Data & Technology"}]}"
```



### Development-only free scan reset

When `APP_ENV=development` and `ALLOW_DEV_MOCK_UNLOCK=true`, the backend exposes a dev-only reset endpoint for Expo testing:

```bash
curl -X POST "$BASE_URL/api/dev/reset-free-scan" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"YOUR_TEST_DEVICE_ID"}'
```

This route deletes the test device row plus related reports, interviews, usage, and entitlements. It returns 404 outside development mode.


### Development reset-all endpoint

When `APP_ENV=development` and `ALLOW_DEV_MOCK_UNLOCK=true`, the backend exposes a nuclear dev reset endpoint for repeat Expo tests:

```bash
curl -X POST "$BASE_URL/api/dev/reset-all-free-scans" \
  -H "Content-Type: application/json" \
  -d '{}'
```

This deletes dev devices, usage, interviews, reports, and entitlements in the development database only. It returns 404 unless development dev-unlock is enabled.

## Free scan confidence/cost polish proof

Branch goal: keep onboarding free-scan cheap and honest.

Before every manual test in development, reset the dev scan state:

```powershell
curl.exe -i -X POST "https://deepprep-ios-dev.onrender.com/api/dev/reset-all-free-scans" `
  -H "Content-Type: application/json" `
  -d "{}"
```

Expected free-scan behavior:
- Uses a cost-capped preview query pack: 1 company query + 2 interviewer queries.
- Uses Tavily `basic` search depth for the free scan; paid full reports keep deeper search.
- Shows a display confidence that is capped when current-role freshness is stale/unclear.
- Filters noisy sources such as YouTube/Wikipedia from prominent source notes.
```
