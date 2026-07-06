"""Search provider abstraction.

Production: Tavily live web search (set TAVILY_API_KEY).
Dev/mock: deterministic fixtures behind ENABLE_MOCK_SEARCH=true.

Safety rule:
- ENABLE_MOCK_SEARCH=true  -> fixture search allowed.
- ENABLE_MOCK_SEARCH=false -> Tavily key is required; missing key raises a
  clear configuration error. Never silently fake user-facing search output.
"""
from typing import List
import httpx

from ..config import get_settings


class SearchConfigError(RuntimeError):
    """Raised when live search is requested but not configured."""


class SearchProviderError(RuntimeError):
    """Raised when the configured live search provider fails."""


class SearchResult(dict):
    """A single search hit: {title, url, content, domain, publishedDate?}."""


class SearchProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.query_count = 0
        self.result_count = 0
        self.using_mock = self.settings.enable_mock_search
        self.provider_name = "mock" if self.using_mock else "tavily"

    async def search_pack(self, queries: List[str]) -> List[SearchResult]:
        results: List[SearchResult] = []
        for q in queries:
            self.query_count += 1
            hits = await self._run(q)
            results.extend(hits)
        self.result_count = len(results)
        return results

    async def _run(self, query: str) -> List[SearchResult]:
        if self.settings.enable_mock_search:
            return self._mock(query)

        if not self.settings.tavily_api_key:
            raise SearchConfigError(
                "TAVILY_API_KEY is not configured and ENABLE_MOCK_SEARCH=false. "
                "Set TAVILY_API_KEY for live search or enable ENABLE_MOCK_SEARCH=true "
                "for local development fixtures."
            )

        return await self._tavily_search(query)

    def _mock(self, query: str) -> List[SearchResult]:
        # Dev-only fixture. This path is used only when ENABLE_MOCK_SEARCH=true.
        return [
            SearchResult(
                title=f"Mock public result for: {query}",
                url="https://www.linkedin.com/in/example",
                content=f"Mock search snippet related to '{query}'.",
                domain="linkedin.com",
                publishedDate="",
            )
        ]

    async def _tavily_search(self, query: str) -> List[SearchResult]:
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.settings.tavily_api_key,
                        "query": query,
                        "max_results": 5,
                        "search_depth": "advanced",
                        "include_answer": False,
                        "include_raw_content": False,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response is not None else "unknown"
            raise SearchProviderError(f"Tavily search failed with HTTP {status}") from exc
        except httpx.HTTPError as exc:
            raise SearchProviderError(f"Tavily search request failed: {exc}") from exc

        out: List[SearchResult] = []
        for r in data.get("results", []):
            url = r.get("url", "")
            out.append(
                SearchResult(
                    title=r.get("title", ""),
                    url=url,
                    content=r.get("content", ""),
                    domain=_domain(url),
                    publishedDate=r.get("published_date", "") or r.get("publishedDate", ""),
                )
            )
        return out


def _domain(url: str) -> str:
    try:
        return url.split("/")[2].replace("www.", "")
    except Exception:
        return ""
