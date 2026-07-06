"""Central configuration for DeepPrep backend.

All production values should come from environment variables. Local development
can run against localhost MongoDB and explicit mock search/LLM flags.
"""
import os
from functools import lru_cache


def _flag(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.app_env: str = os.environ.get("APP_ENV", "development").strip().lower()
        is_production = self.app_env == "production"

        # MongoDB. Local dev may default to localhost; production must be explicit.
        mongo_url = os.environ.get("MONGO_URL", "").strip()
        if not mongo_url and is_production:
            raise RuntimeError("MONGO_URL is required when APP_ENV=production")
        self.mongo_url: str = mongo_url or "mongodb://localhost:27017"
        self.db_name: str = os.environ.get("DB_NAME", "deepprep")

        # LLM provider selection.
        self.llm_provider: str = os.environ.get("LLM_PROVIDER", "openai").strip().lower()
        self.openai_model: str = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        self.anthropic_model: str = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")

        # Provider keys. Do not depend on platform-specific/shared keys.
        self.openai_api_key: str = os.environ.get("OPENAI_API_KEY", "").strip()
        self.anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "").strip()

        # Search provider.
        self.tavily_api_key: str = os.environ.get("TAVILY_API_KEY", "").strip()

        # Mock flags are explicit. Development defaults to mock; production defaults to live.
        dev_mock_default = "false" if is_production else "true"
        self.enable_mock_search: bool = _flag("ENABLE_MOCK_SEARCH", dev_mock_default)
        self.enable_mock_llm: bool = _flag("ENABLE_MOCK_LLM", dev_mock_default)

        # --- Spend / usage caps (server-authoritative placeholders) ---
        self.free_scan_daily_global_cap: int = int(os.environ.get("FREE_SCAN_DAILY_GLOBAL_CAP", "500"))
        self.free_scan_daily_spend_cap_gbp: float = float(os.environ.get("FREE_SCAN_DAILY_SPEND_CAP_GBP", "25"))
        self.paid_daily_spend_cap_gbp: float = float(os.environ.get("PAID_DAILY_SPEND_CAP_GBP", "100"))
        self.paid_weekly_spend_cap_gbp: float = float(os.environ.get("PAID_WEEKLY_SPEND_CAP_GBP", "500"))
        self.max_daily_credits_per_user: int = int(os.environ.get("MAX_DAILY_CREDITS_PER_USER", "3"))
        self.max_weekly_credits_per_user: int = int(os.environ.get("MAX_WEEKLY_CREDITS_PER_USER", "6"))

        # StoreKit / entitlement.
        self.apple_bundle_id: str = os.environ.get("APPLE_BUNDLE_ID", "")
        self.apple_issuer_id: str = os.environ.get("APPLE_ISSUER_ID", "")
        self.apple_key_id: str = os.environ.get("APPLE_KEY_ID", "")
        self.apple_private_key: str = os.environ.get("APPLE_PRIVATE_KEY", "")
        self.app_attest_enabled: bool = _flag("APP_ATTEST_ENABLED", "false")

        # Local-only purchase/testing escape hatch. Never allow this outside development.
        self.allow_dev_mock_unlock: bool = self.app_env == "development" and _flag("ALLOW_DEV_MOCK_UNLOCK", "true")

    @property
    def has_llm_key(self) -> bool:
        return bool(self.openai_api_key or self.anthropic_api_key)

    def resolved_llm(self) -> tuple[str, str, str]:
        """Return (provider, model, api_key) to use for synthesis."""
        if self.llm_provider == "anthropic":
            return "anthropic", self.anthropic_model, self.anthropic_api_key
        return "openai", self.openai_model, self.openai_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
