from fastapi import APIRouter
from .config import get_settings

router = APIRouter()


@router.get("/health")
async def health():
    s = get_settings()
    provider, model, api_key = s.resolved_llm()
    live_search_ready = (not s.enable_mock_search) and bool(s.tavily_api_key)
    live_llm_ready = (not s.enable_mock_llm) and bool(api_key)
    return {
        "status": "ok",
        "app_env": s.app_env,
        "mock_search": s.enable_mock_search,
        "mock_llm": s.enable_mock_llm,
        "search_key_present": bool(s.tavily_api_key),
        "llm_key_present": bool(api_key),
        "llm_provider": provider,
        "llm_model": model,
        "live_search_ready": live_search_ready,
        "live_llm_ready": live_llm_ready,
        "dev_mock_unlock_allowed": s.allow_dev_mock_unlock,
    }
