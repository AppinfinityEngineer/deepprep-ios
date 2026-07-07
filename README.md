
# DeepPrep — Interview Prep AI

**ThoughtSnap Labs iOS product.** DeepPrep is a premium, iOS-first interview-intelligence app.
Users enter a company, role, interview date, job description and known interviewers. DeepPrep creates a private interview preparation brief with company context, interviewer dossiers, likely questions, smart talking points, confidence/freshness notes and a day-of brief.

DeepPrep is positioned as a **career-preparation app**, not a people-search, stalking, background-check or OSINT product.

## Stack

- **Frontend:** React Native + TypeScript + Expo + Expo Router
- **Backend:** FastAPI + MongoDB
- **Search:** Tavily live web search when configured
- **AI:** OpenAI / Anthropic synthesis when configured
- **Payments:** Native StoreKit / ThoughtSnap Labs entitlement pattern only. **No RevenueCat.**

## Repo layout

```text
frontend/   Expo iOS app
backend/    FastAPI backend
memory/     product notes
```

## Local setup

### Backend

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

Health check:

```bash
curl http://localhost:8001/api/health
```

Local development defaults to mock search/LLM unless changed in `backend/.env`.
Production must set real keys and disable mock flags.

### Frontend

```bash
cd frontend
cp .env.example .env
 yarn install
 yarn typecheck
 yarn lint
 yarn start
```

Set `EXPO_PUBLIC_BACKEND_URL` to your backend, for example `http://localhost:8001`.

## Mock vs live mode

DeepPrep must never silently fake production user-facing reports.

Development mock mode is explicit:

```env
ENABLE_MOCK_SEARCH=true
ENABLE_MOCK_LLM=true
```

Live mode:

```env
ENABLE_MOCK_SEARCH=false
ENABLE_MOCK_LLM=false
TAVILY_API_KEY=...
OPENAI_API_KEY=...      # or ANTHROPIC_API_KEY
```

If mock mode is off and a required key is missing, the backend should fail clearly instead of returning fake data.

## API

```text
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

## Product guardrails

- One free lite Intel Scan during onboarding.
- Server-authoritative free scan eligibility.
- Native StoreKit subscription only.
- Product ID: `deepprep_pro_weekly`.
- Entitlement: `deepprep_pro`.
- No introductory offer. Free Intel Scan before subscribing.
- Weekly: £7.99/week, 6 Intel Credits/week.
- Backend remains authoritative for credits, usage and entitlement state.
- Reports must show confidence/freshness notes and avoid sensitive/private personal claims.

## Branch map

Current `main` is the generated V3 baseline. Development proceeds by patches only, branch by branch:

```text
1. chore/v3-repo-hygiene-production-config
2. fix/v3-mock-live-safety-gates
3. fix/v3-profile-evidence-free-scan-flow
4. feature/v3-live-tavily-discovery-proof
5. feature/v3-real-llm-synthesis-validation
6. feature/v3-backend-security-credit-caps
7. feature/v3-storekit-native-entitlement
8. feature/v3-apple-review-polish
9. feature/v3-devicecheck-appattest-free-scan
10. release/v3-testflight-readiness
```

## Apple-review positioning

Use safe language everywhere:

> DeepPrep uses user-supplied interview details and publicly available professional information to generate private interview preparation briefs with confidence and freshness notes.

Avoid language such as spy, stalk, hidden data, find anyone, background check, dox, or OSINT.


## Store / legal

- Subscription: £7.99/week (`deepprep_pro_weekly`)
- Introductory offer: none
- Free Intel Scan is the conversion proof before subscribing
- Privacy Policy: https://thoughtsnaplabs.com/deepprep/privacy
- Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
- iPad support: off
- EAS autoIncrement: off; manual build bumps only
