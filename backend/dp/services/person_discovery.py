"""Build a per-interviewer search query pack and gather candidate signals."""
from typing import Dict, List
from ..models import InterviewerIn
from .search_provider import SearchProvider


def query_pack(interviewer: InterviewerIn, company: str, role: str) -> List[str]:
    name = interviewer.name
    queries = [
        f'"{name}" {company}',
        f'"{name}" {interviewer.title or role}',
        f'"{name}" linkedin',
    ]
    if interviewer.linkedinUrl:
        queries.append(interviewer.linkedinUrl)
    return queries


async def discover(interviewer: InterviewerIn, company: str, role: str, provider: SearchProvider) -> Dict:
    queries = query_pack(interviewer, company, role)
    hits = await provider.search_pack(queries)
    return {
        "queries": queries,
        "hits": hits,
        "domains": sorted({h.get("domain", "") for h in hits if h.get("domain")}),
        "urls": [h.get("url", "") for h in hits if h.get("url")],
        "dates": [h.get("publishedDate", "") for h in hits if h.get("publishedDate")],
    }
