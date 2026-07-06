"""Resolve a company name into a normalised entity + query context.

With mock search this returns a lightweight resolved object; with live Tavily
it would aggregate company signals. TODO(branch-1): enrich with real data.
"""
from typing import Dict
from .search_provider import SearchProvider


async def resolve_company(company: str, provider: SearchProvider) -> Dict:
    queries = [
        f"{company} company overview",
        f"{company} recent news",
        f"{company} engineering culture hiring",
    ]
    hits = await provider.search_pack(queries)
    return {
        "name": company,
        "resolved": True,
        "sourceCount": len(hits),
        "sourceDomains": sorted({h.get("domain", "") for h in hits if h.get("domain")}),
    }
