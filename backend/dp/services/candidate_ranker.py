"""Deterministic candidate scoring from actual search evidence.

Branch 4 rule: never award identity points merely because the user supplied a
name/company. Score only from returned source evidence or user-supplied profile
text. This lowers wrong-person risk for common names.
"""
from __future__ import annotations

from typing import Dict, List

from ..models import InterviewerIn, PersonCandidate
from .source_classifier import classify


def _clamp(v: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, v))


def score_candidate(interviewer: InterviewerIn, company: str, role: str, discovery: Dict) -> PersonCandidate:
    signals: List[str] = []
    conflicts: List[str] = list(discovery.get("conflictSignals", []))
    score = 0

    domains = discovery.get("domains", [])
    urls = discovery.get("urls", [])
    source_types = discovery.get("sourceTypes", [])
    profile_urls = discovery.get("profileUrls", [])
    image_urls = discovery.get("imageUrls", [])
    has_profile_source = bool(profile_urls) or any(classify(d) == "profile" for d in domains)
    only_directory = bool(domains) and all(classify(d) == "directory" for d in domains)

    name_hits = int(discovery.get("nameHitCount", 0) or 0)
    company_hits = int(discovery.get("companyHitCount", 0) or 0)
    title_hits = int(discovery.get("titleHitCount", 0) or 0)
    role_hits = int(discovery.get("roleHitCount", 0) or 0)
    freshness_signals = discovery.get("freshnessSignals", [])
    stale_signals = discovery.get("staleSignals", [])

    if name_hits:
        score += 25
        signals.append(f"Name appears in {name_hits} live search result(s)")
    else:
        conflicts.append("No returned source clearly contained the interviewer name")

    if company_hits:
        score += 30
        signals.append(f"Company appears in {company_hits} returned source result(s)")
    else:
        conflicts.append("No returned source clearly tied the person to the target company")

    if title_hits:
        score += 15
        signals.append(f"Title/context appears in {title_hits} source result(s)")
    elif interviewer.title:
        conflicts.append("Provided title was not corroborated by returned sources")

    if role_hits:
        score += 10
        signals.append(f"Role-domain terms appear in {role_hits} source result(s)")

    if interviewer.linkedinUrl or has_profile_source:
        score += 10
        signals.append("Professional profile/source URL located")

    if len(source_types) >= 2:
        score += 10
        signals.append(f"Multiple source types reviewed: {', '.join(source_types)}")

    if discovery.get("dates") or freshness_signals:
        score += 5
        signals.append("Returned sources include date/current-role style signals")

    profile_evidence = bool((interviewer.profileText or "").strip())
    if profile_evidence:
        score += 25
        signals.append("User-supplied profile evidence provided")

    if stale_signals:
        conflicts.append("Some public results use stale/previous-role language")
    if only_directory:
        score -= 10
        conflicts.append("Only directory/scraper sources, no corroborating source type")
    if not interviewer.title and not interviewer.linkedinUrl and name_hits > company_hits + 3:
        score -= 10
        conflicts.append("Common-name ambiguity risk: name appears more often than company-corroborated results")
    if not urls:
        score -= 25
        conflicts.append("No live source URLs returned")

    identity_score = _clamp(score)
    identity_conf, action = _map_identity(identity_score)
    fresh, role_status = _initial_freshness(profile_evidence, freshness_signals, stale_signals, conflicts)

    return PersonCandidate(
        name=interviewer.name,
        possibleTitle=interviewer.title,
        possibleCompany=company if company_hits or profile_evidence else None,
        profileImageUrl=(image_urls[0] if image_urls else None),
        profileUrls=_dedupe(([interviewer.linkedinUrl] if interviewer.linkedinUrl else []) + profile_urls),
        sourceUrls=urls,
        sourceDomains=domains,
        identityScore=identity_score,
        identityConfidence=identity_conf,
        currentRoleFreshness=fresh,
        currentRoleStatus=role_status,
        evidenceSignals=signals,
        conflictingSignals=conflicts,
        lastSeenDates=[d for d in discovery.get("dates", []) if d],
        recommendedAction=action,
    )


def _map_identity(score: int):
    if score >= 85:
        return "high", "auto_accept"
    if score >= 65:
        return "medium", "use_with_caveat"
    if score >= 45:
        return "low", "ask_user_to_confirm"
    return "unknown", "insufficient_evidence"


def _initial_freshness(profile_evidence: bool, freshness_signals: List[str], stale_signals: List[str], conflicts: List[str]):
    if profile_evidence:
        return "high", "verified_from_user_profile_evidence"
    if stale_signals or any("stale" in c.lower() for c in conflicts):
        return "low", "stale_public_data"
    if freshness_signals:
        return "medium", "latest_public_data"
    return "low", "stale_public_data"


def _dedupe(items: List[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for item in items:
        clean = " ".join((item or "").split())
        if clean and clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out
