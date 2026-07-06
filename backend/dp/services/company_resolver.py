"""Resolve company search context from live web sources."""
from __future__ import annotations

from typing import Dict, List

from .search_provider import SearchProvider


def company_query_pack(company: str, role: str | None = None) -> List[str]:
    quoted = f'"{company}"'
    queries = [
        f"{quoted} company overview",
        f"{quoted} recent news",
        f"{quoted} careers engineering data hiring",
        f"{quoted} interview questions {role or ''}".strip(),
        f"{quoted} leadership technology data",
    ]
    return _dedupe(queries)


async def resolve_company(company: str, provider: SearchProvider, *, role: str | None = None, max_queries: int = 3) -> Dict:
    queries = company_query_pack(company, role=role)[:max_queries]
    hits = await provider.search_pack(queries, max_results_per_query=4, search_depth="advanced")
    domains = sorted({h.get("domain", "") for h in hits if h.get("domain")})
    titles = [h.get("title", "") for h in hits if h.get("title")][:6]
    snippets = [h.get("content", "") for h in hits if h.get("content")][:6]
    return {
        "name": company,
        "resolved": bool(hits),
        "queries": queries,
        "sourceCount": len(hits),
        "sourceDomains": domains,
        "topTitles": titles,
        "snippets": snippets,
        "sourceUrls": [h.get("url", "") for h in hits if h.get("url")][:8],
    }


def _dedupe(items: List[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for item in items:
        clean = " ".join(item.split())
        if clean and clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out
