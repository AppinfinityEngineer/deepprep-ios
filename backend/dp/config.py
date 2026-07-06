"""Central configuration for DeepPrep backend.

All values come from environment variables (see backend/.env.example).
Nothing here should be hardcoded for production; ThoughtSnap Labs can wire
their own keys later without touching application code.
"""
import os
from functools import lru_cache


def _flag(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.app_env: str = os.environ.get("APP_ENV", "development")

        # Mongo (uses the platform-provided MONGO_URL / DB_NAME).
        self.mongo_url: str = os.environ["MONGO_URL"]
        self.db_name: str = os.environ.get("DB_NAME", "deepprep")

        # LLM provider selection.
        self.llm_provider: str = os.environ.get("LLM_PROVIDER", "openai")
        self.openai_model: str = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        self.anthropic_model: str = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

        # Keys. If a provider-specific key is present we use it; otherwise we
        # fall back to the Emergent universal key. ThoughtSnap Labs should set
        # OPENAI_API_KEY / ANTHROPIC_API_KEY for production and drop the
        # universal key dependency.
        self.openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
        self.anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
        self.emergent_llm_key: str = os.environ.get("EMERGENT_LLM_KEY", "")

        # Search provider (Tavily).
        self.tavily_api_key: str = os.environ.get("TAVILY_API_KEY", "")

        # Mock flags — explicit, never silent. Default production expects keys.
        self.enable_mock_search: bool = _flag("ENABLE_MOCK_SEARCH", "true")
        self.enable_mock_llm: bool = _flag("ENABLE_MOCK_LLM", "false")

        # --- Spend / usage caps (server-authoritative placeholders) ---
        self.free_scan_daily_global_cap: int = int(os.environ.get("FREE_SCAN_DAILY_GLOBAL_CAP", "500"))
        self.free_scan_daily_spend_cap_gbp: float = float(os.environ.get("FREE_SCAN_DAILY_SPEND_CAP_GBP", "25"))
        self.paid_daily_spend_cap_gbp: float = float(os.environ.get("PAID_DAILY_SPEND_CAP_GBP", "100"))
        self.paid_weekly_spend_cap_gbp: float = float(os.environ.get("PAID_WEEKLY_SPEND_CAP_GBP", "500"))
        self.max_daily_credits_per_user: int = int(os.environ.get("MAX_DAILY_CREDITS_PER_USER", "3"))
        self.max_weekly_credits_per_user: int = int(os.environ.get("MAX_WEEKLY_CREDITS_PER_USER", "6"))

        # StoreKit / entitlement.
        self.apple_bundle_id: str = os.environ.get("APPLE_BUNDLE_ID", "")
        self.app_attest_enabled: bool = _flag("APP_ATTEST_ENABLED", "false")

    @property
    def has_llm_key(self) -> bool:
        return bool(self.openai_api_key or self.anthropic_api_key or self.emergent_llm_key)

    def resolved_llm(self) -> tuple[str, str, str]:
        """Return (provider, model, api_key) to use for synthesis."""
        if self.llm_provider == "anthropic":
            key = self.anthropic_api_key or self.emergent_llm_key
            return "anthropic", self.anthropic_model, key
        key = self.openai_api_key or self.emergent_llm_key
        return "openai", self.openai_model, key


@lru_cache
def get_settings() -> Settings:
    return Settings()
