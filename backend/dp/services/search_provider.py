"""Search provider abstraction.

Production: Tavily live web search (set TAVILY_API_KEY).
Dev/mock: deterministic fixtures behind ENABLE_MOCK_SEARCH=true.

TODO(branch-1): Wire real Tavily search calls in `_tavily_search`.
"""
from typing import List, Dict
import httpx

from ..config import get_settings


class SearchResult(dict):
    """A single search hit: {title, url, content, domain, publishedDate?}."""


class SearchProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.query_count = 0
        self.result_count = 0

    async def search_pack(self, queries: List[str]) -> List[SearchResult]:
        results: List[SearchResult] = []
        for q in queries:
            self.query_count += 1
            hits = await self._run(q)
            results.extend(hits)
        self.result_count = len(results)
        return results

    async def _run(self, query: str) -> List[SearchResult]:
        if self.settings.enable_mock_search or not self.settings.tavily_api_key:
            # Explicit mock mode. Returns lightweight structured stubs so the
            # deterministic scoring + LLM synthesis pipeline still runs end to
            # end. These are NOT shown to the user as facts — they seed the
            # pipeline. Real facts come from Tavily once wired.
            return self._mock(query)
        return await self._tavily_search(query)

    def _mock(self, query: str) -> List[SearchResult]:
        return [
            SearchResult(
                title=f"Public result for: {query}",
                url="https://www.linkedin.com/in/example",
                content=f"Mock search snippet related to '{query}'.",
                domain="linkedin.com",
                publishedDate="",
            )
        ]

    async def _tavily_search(self, query: str) -> List[SearchResult]:
        # TODO(branch-1): implement production Tavily call + error handling.
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.settings.tavily_api_key,
                    "query": query,
                    "max_results": 5,
                    "search_depth": "advanced",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        out: List[SearchResult] = []
        for r in data.get("results", []):
            url = r.get("url", "")
            out.append(
                SearchResult(
                    title=r.get("title", ""),
                    url=url,
                    content=r.get("content", ""),
                    domain=_domain(url),
                    publishedDate=r.get("published_date", ""),
                )
            )
        return out


def _domain(url: str) -> str:
    try:
        return url.split("/")[2].replace("www.", "")
    except Exception:
        return ""
