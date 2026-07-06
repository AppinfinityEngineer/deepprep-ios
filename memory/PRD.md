# DeepPrep: Interview Prep AI — PRD

## Original problem statement
iOS-first interview-intelligence app (ThoughtSnap Labs). User enters company,
role, interview date, interviewers, optional JD/profile evidence. App generates
a premium interview brief: interviewer dossiers, company signals, likely
questions, smart talking points, confidence/freshness notes, day-of brief.
Differentiator: searches public professional signals, matches likely
interviewers, checks freshness/confidence, turns it into a useful brief.
Premium black-and-white, red accent, App Store ready, honest about uncertainty.

## Architecture
- Frontend: React Native + TypeScript + Expo Router (iOS-first). Global state via
  `src/state/AppContext`. Services: theme, haptics, api, storage repo, storekit,
  review (weighted), notifications (stub). File-based routing under `app/`.
- Backend: FastAPI (`server.py` → `dp/` package), MongoDB (motor). Pipeline:
  company_resolver → person_discovery → candidate_ranker (deterministic scoring)
  → freshness → llm_provider (OpenAI/Anthropic synthesis) → report_service.
  Server-authoritative entitlement + free-scan abuse protection.
- AI: real synthesis via OpenAI/Anthropic (Emergent universal key or own keys).
  Search stubbed for Tavily. Explicit mock flags, never silent fakes.

## User personas
- Active job seeker prepping for a specific interview (primary).
- Career switcher researching an unfamiliar company/interviewer.

## Core requirements (static)
- Long premium onboarding, free limited Intel Scan, dedicated review page,
  HARD paywall (no X), full report with dossiers/questions/day-of, settings.
- Free scan capped per device/global; server-authoritative credits.
- Premium B/W + red design; haptics throughout; honest confidence/freshness.

## Implemented (2026-07-06)
- Full onboarding wizard (9 steps) + progress theatre + free scan result.
- Review page (weighted review system), hard paywall (no close), StoreKit stub
  with dev mock unlock, restore purchases.
- Home / Briefs / Alerts / Settings tabs; New Brief; Generating theatre;
  tabbed Report (Overview/Dossiers/Questions/Day-of); Interviewer Dossier;
  legal (privacy/terms) placeholders; delete-my-data.
- Backend: health, free-scan eligibility/create/get, reports CRUD+list, entitlement
  sync/get, usage, privacy delete. Deterministic scoring + freshness + cost tracking.
- Custom DeepPrep radar icon/splash; no Emergent branding. TS + Python compile.
- Tested: backend 9/9 pytest pass; all frontend critical flows pass.

## Current mock state
- `ENABLE_MOCK_LLM=true` (Emergent universal key balance exhausted — dev fixtures
  through the real pipeline). `ENABLE_MOCK_SEARCH=true` (no Tavily key).
- StoreKit purchase/restore stubbed (`DEV_MOCK_UNLOCK=true`).

## Backlog (P0/P1/P2)
- P0: Top up Emergent key OR add OPENAI_API_KEY, set ENABLE_MOCK_LLM=false (real briefs).
- P1: Wire Tavily search (branch-1); real StoreKit/RevenueCat (branch-5);
  App Store Server API entitlement verification (branch-4).
- P1: Concurrency-safe credits ($inc), FastAPI lifespan (replace on_event).
- P2: DeviceCheck/App Attest verification (branch-6); real notifications scheduling
  (branch-8); production privacy/terms (branch-7); App Store metadata (branch-9);
  admin caps dashboard (branch-10). Hydrate dossier detail from in-memory report.

## Next tasks
1. Add balance/own key → flip ENABLE_MOCK_LLM to false, verify real synthesis.
2. Wire Tavily search + set ENABLE_MOCK_SEARCH=false.
3. Real StoreKit products + entitlement verification for TestFlight.
