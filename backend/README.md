# DeepPrep Backend (FastAPI + MongoDB)

Entrypoint: `server.py` (mounts `dp.router` under `/api`).

```
dp/
  config.py                 # env + caps
  db.py                     # motor collections
  models.py                 # pydantic schema (Interview, Report, PersonCandidate, ...)
  utils.py                  # ids, timestamps, hashing
  services/
    search_provider.py      # Tavily (stubbed) / mock
    company_resolver.py
    person_discovery.py
    candidate_ranker.py     # deterministic scoring
    freshness.py            # current-role freshness (separate from identity)
    source_classifier.py
    cost_tracker.py
    llm_provider.py         # OpenAI/Anthropic synthesis (provider switch)
    entitlement_service.py  # server-authoritative credits/entitlement
    free_scan_service.py    # eligibility + abuse protection
    report_service.py       # pipeline orchestration
  routes_*.py               # health / free-scan / reports / entitlement / privacy
```

## Run
```
cp .env.example .env
/root/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
curl localhost:8001/api/health
```

## Env
See `.env.example`. Key toggles: `ENABLE_MOCK_SEARCH`, `ENABLE_MOCK_LLM`,
`LLM_PROVIDER`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `TAVILY_API_KEY`. Caps: `FREE_SCAN_DAILY_GLOBAL_CAP`,
`MAX_WEEKLY_CREDITS_PER_USER`, etc.

Do not silently return fake data in production: with `ENABLE_MOCK_LLM=false` and
no key, `/reports` returns HTTP 503 `llm_not_configured` (credit refunded).
