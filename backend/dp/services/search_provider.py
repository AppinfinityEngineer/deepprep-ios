"""Search provider abstraction for DeepPrep.

Production path: Tavily live web search (TAVILY_API_KEY required when
ENABLE_MOCK_SEARCH=false). Development fixtures are available only behind
ENABLE_MOCK_SEARCH=true.

Branch 4 goal: make live search measurable and source-aware while still keeping
LLM synthesis mocked until branch 5. No silent fake search is allowed.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

import httpx

from ..config import get_settings


class SearchConfigError(RuntimeError):
    """Raised when live search is requested but not configured."""


class SearchProviderError(RuntimeError):
    """Raised when the configured live search provider fails."""


class SearchResult(dict):
    """A single search hit: {title, url, content, domain, publishedDate?, score?}."""


class SearchProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.query_count = 0
        self.result_count = 0
        self.credit_count = 0
        self.usage_events: List[Dict[str, Any]] = []
        self.using_mock = self.settings.enable_mock_search
        self.provider_name = "mock" if self.using_mock else "tavily"

    async def search_pack(
        self,
        queries: Iterable[str],
        *,
        max_results_per_query: int = 4,
        search_depth: str = "advanced",
    ) -> List[SearchResult]:
        """Run a bounded query pack and return URL-deduped results."""
        results: List[SearchResult] = []
        seen_urls: set[str] = set()
        for q in [x.strip() for x in queries if x and x.strip()]:
            self.query_count += 1
            hits = await self._run(q, max_results=max_results_per_query, search_depth=search_depth)
            for hit in hits:
                url = (hit.get("url") or "").strip()
                key = url or f"{hit.get('title','')}::{hit.get('content','')[:80]}"
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                results.append(hit)
        self.result_count = len(results)
        return results

    async def _run(self, query: str, *, max_results: int, search_depth: str) -> List[SearchResult]:
        if self.settings.enable_mock_search:
            self.credit_count += 1
            return self._mock(query)

        if not self.settings.tavily_api_key:
            raise SearchConfigError(
                "TAVILY_API_KEY is not configured and ENABLE_MOCK_SEARCH=false. "
                "Set TAVILY_API_KEY for live search or enable ENABLE_MOCK_SEARCH=true "
                "for local development fixtures."
            )

        return await self._tavily_search(query, max_results=max_results, search_depth=search_depth)

    def _mock(self, query: str) -> List[SearchResult]:
        # Dev-only fixture. This path is used only when ENABLE_MOCK_SEARCH=true.
        return [
            SearchResult(
                title=f"Mock public result for: {query}",
                url="https://www.linkedin.com/in/example",
                content=f"Mock search snippet related to '{query}'.",
                domain="linkedin.com",
                publishedDate="",
                score=0.5,
                query=query,
            )
        ]

    async def _tavily_search(self, query: str, *, max_results: int, search_depth: str) -> List[SearchResult]:
        payload: Dict[str, Any] = {
            "api_key": self.settings.tavily_api_key,
            "query": query,
            "max_results": max(1, min(max_results, 8)),
            "search_depth": search_depth,
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
            # Tavily supports usage/credit data on supported accounts/endpoints.
            # If absent, we estimate credits below.
            "include_usage": True,
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post("https://api.tavily.com/search", json=payload)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response is not None else "unknown"
            body = ""
            try:
                body = exc.response.text[:400] if exc.response is not None else ""
            except Exception:
                body = ""
            raise SearchProviderError(f"Tavily search failed with HTTP {status}: {body}") from exc
        except httpx.HTTPError as exc:
            raise SearchProviderError(f"Tavily search request failed: {exc}") from exc

        usage = data.get("usage") or data.get("credits") or {}
        credits = _extract_credit_usage(usage)
        if credits is None:
            # Tavily credit model: advanced search is typically 2 credits; basic 1.
            credits = 2 if search_depth == "advanced" else 1
        self.credit_count += credits
        self.usage_events.append({"query": query, "credits": credits, "usage": usage or None})

        out: List[SearchResult] = []
        for r in data.get("results", []) or []:
            url = (r.get("url") or "").strip()
            title = (r.get("title") or "").strip()
            content = (r.get("content") or r.get("snippet") or "").strip()
            out.append(
                SearchResult(
                    title=title,
                    url=url,
                    content=content,
                    domain=_domain(url),
                    publishedDate=r.get("published_date", "") or r.get("publishedDate", "") or "",
                    score=r.get("score", None),
                    query=query,
                )
            )
        return out


def _extract_credit_usage(usage: Any) -> Optional[int]:
    if isinstance(usage, int):
        return usage
    if isinstance(usage, float):
        return int(round(usage))
    if isinstance(usage, dict):
        for key in ("credits", "credit_count", "total_credits", "api_credits"):
            value = usage.get(key)
            if isinstance(value, (int, float)):
                return int(round(value))
    return None


def _domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""
