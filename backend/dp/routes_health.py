from fastapi import APIRouter
from .config import get_settings

router = APIRouter()


@router.get("/health")
async def health():
    s = get_settings()
    return {
        "status": "ok",
        "app_env": s.app_env,
        "mock_search": s.enable_mock_search,
        "mock_llm": s.enable_mock_llm,
        "llm_key_present": s.has_llm_key,
        "search_key_present": bool(s.tavily_api_key),
    }
