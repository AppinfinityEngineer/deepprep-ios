"""Build per-interviewer search packs and extract source-backed signals."""
from __future__ import annotations

import re
from typing import Dict, List

from ..models import InterviewerIn
from .search_provider import SearchProvider
from .source_classifier import classify


def _tokens(value: str | None) -> List[str]:
    return [t.lower() for t in re.findall(r"[a-zA-Z][a-zA-Z0-9+.#-]{2,}", value or "")]


def _contains_phrase(text: str, phrase: str) -> bool:
    return phrase.lower() in text.lower()


def _contains_any(text: str, tokens: List[str]) -> bool:
    hay = text.lower()
    return any(t in hay for t in tokens if len(t) >= 3)


def query_pack(interviewer: InterviewerIn, company: str, role: str, *, max_queries: int = 8) -> List[str]:
    name = interviewer.name.strip()
    title = (interviewer.title or "").strip()
    quoted_name = f'"{name}"'
    quoted_company = f'"{company}"'
    title_or_role = title or role
    role_tokens = _tokens(role)
    domain_terms = " ".join(role_tokens[:3]) if role_tokens else role

    # Ordered from cheapest/highest-signal to deeper paid-report research.
    queries = [
        f"{quoted_name} {quoted_company} LinkedIn",
        f"{quoted_name} {quoted_company} {title_or_role}",
        f"site:linkedin.com/in {quoted_name} {quoted_company}",
        f"{quoted_name} {quoted_company} {domain_terms}",
        f"{quoted_name} {quoted_company} director manager lead engineering data technology",
        f"{quoted_name} {quoted_company} conference podcast blog github medium",
        f"{quoted_name} {quoted_company} The Org Wiza FinalScout",
    ]
    if interviewer.linkedinUrl:
        queries.insert(0, interviewer.linkedinUrl)
    return _dedupe(queries)[:max_queries]


async def discover(
    interviewer: InterviewerIn,
    company: str,
    role: str,
    provider: SearchProvider,
    *,
    max_queries: int = 8,
    max_results_per_query: int = 4,
    search_depth: str = "advanced",
) -> Dict:
    queries = query_pack(interviewer, company, role, max_queries=max_queries)
    hits = await provider.search_pack(
        queries,
        max_results_per_query=max_results_per_query,
        search_depth=search_depth,
    )

    name = interviewer.name.strip()
    title_tokens = _tokens(interviewer.title)
    role_tokens = _tokens(role)
    company_norm = company.strip().lower()

    name_hits = []
    company_hits = []
    title_hits = []
    role_hits = []
    profile_urls = []
    freshness_signals = []
    stale_signals = []
    conflict_signals = []

    for h in hits:
        text = f"{h.get('title','')} {h.get('content','')} {h.get('url','')}"
        lower = text.lower()
        domain = h.get("domain", "")
        if _contains_phrase(text, name):
            name_hits.append(_hit_label(h))
        if company_norm and company_norm in lower:
            company_hits.append(_hit_label(h))
        if title_tokens and _contains_any(text, title_tokens):
            title_hits.append(_hit_label(h))
        if role_tokens and _contains_any(text, role_tokens):
            role_hits.append(_hit_label(h))
        if classify(domain) == "profile" or "linkedin.com/in" in lower:
            url = h.get("url") or ""
            if url:
                profile_urls.append(url)
        if any(term in lower for term in ("present", "current", "currently", "director", "head of", "lead", "manager")) and company_norm in lower:
            freshness_signals.append(_hit_label(h))
        if any(term in lower for term in ("former", "previously", "ex-", "past role", "left ")):
            stale_signals.append(_hit_label(h))
        if name.lower() in lower and company_norm not in lower and classify(domain) in ("profile", "directory"):
            conflict_signals.append(f"Possible same-name result without company corroboration: {_hit_label(h)}")

    domains = sorted({h.get("domain", "") for h in hits if h.get("domain")})
    source_types = sorted({classify(d) for d in domains})
    dates = [h.get("publishedDate", "") for h in hits if h.get("publishedDate")]

    return {
        "queries": queries,
        "hits": hits,
        "domains": domains,
        "sourceTypes": source_types,
        "urls": [h.get("url", "") for h in hits if h.get("url")],
        "dates": dates,
        "profileUrls": _dedupe(profile_urls),
        "nameHitCount": len(name_hits),
        "companyHitCount": len(company_hits),
        "titleHitCount": len(title_hits),
        "roleHitCount": len(role_hits),
        "freshnessSignals": freshness_signals[:5],
        "staleSignals": stale_signals[:5],
        "conflictSignals": conflict_signals[:5],
        "topTitles": [h.get("title", "") for h in hits if h.get("title")][:6],
        "topSnippets": [h.get("content", "") for h in hits if h.get("content")][:6],
    }


def _hit_label(hit: Dict) -> str:
    title = hit.get("title") or hit.get("url") or "source"
    domain = hit.get("domain") or "unknown-domain"
    return f"{title[:90]} ({domain})"


def _dedupe(items: List[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for item in items:
        clean = " ".join((item or "").split())
        if clean and clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out
