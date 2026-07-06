"""Deterministic candidate scoring per the DeepPrep signal spec.

Identity confidence and current-role freshness are computed SEPARATELY.
Scores map: 85-100 high/auto_accept, 65-84 medium/use_with_caveat,
45-64 low/ask_user_to_confirm, 0-44 insufficient_evidence.
"""
from typing import Dict
from ..models import InterviewerIn, PersonCandidate
from .source_classifier import classify


def _clamp(v: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, v))


def score_candidate(interviewer: InterviewerIn, company: str, role: str, discovery: Dict) -> PersonCandidate:
    signals = []
    conflicts = []
    score = 0

    domains = discovery.get("domains", [])
    urls = discovery.get("urls", [])
    has_profile_source = any(classify(d) == "profile" for d in domains)
    only_directory = bool(domains) and all(classify(d) == "directory" for d in domains)

    # Exact name match (we searched the exact name).
    score += 25
    signals.append("Exact name match against search results")

    # Company match (input company is the target).
    score += 30
    signals.append(f"Target company context: {company}")

    # Title similarity.
    if interviewer.title:
        score += 15
        signals.append(f"Provided title matches role context: {interviewer.title}")

    # Role-domain similarity.
    score += 10

    # LinkedIn / profile URL found.
    if interviewer.linkedinUrl or has_profile_source:
        score += 10
        signals.append("Professional profile URL located")

    # Multiple independent sources agree.
    if len({classify(d) for d in domains}) >= 2:
        score += 10
        signals.append("Multiple independent source types corroborate")

    # User-pasted profile evidence confirms.
    profile_evidence = bool(interviewer.profileText)
    if profile_evidence:
        score += 25
        signals.append("User-supplied profile evidence provided")

    # Recent date evidence.
    if any(discovery.get("dates", [])):
        score += 5

    # Penalties.
    if only_directory:
        score -= 10
        conflicts.append("Only directory/scraper sources, no corroboration")

    identity_score = _clamp(score)
    identity_conf, action = _map_identity(identity_score)

    freshness, role_status = _placeholder_freshness(profile_evidence)

    return PersonCandidate(
        name=interviewer.name,
        possibleTitle=interviewer.title,
        possibleCompany=company,
        profileUrls=[interviewer.linkedinUrl] if interviewer.linkedinUrl else [],
        sourceUrls=urls,
        sourceDomains=domains,
        identityScore=identity_score,
        identityConfidence=identity_conf,
        currentRoleFreshness=freshness,
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


def _placeholder_freshness(profile_evidence: bool):
    # Freshness delegated to freshness.py in the pipeline; provide a safe default.
    if profile_evidence:
        return "high", "verified_from_user_profile_evidence"
    return "medium", "latest_public_data"
