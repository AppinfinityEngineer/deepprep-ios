"""Freshness scoring for a candidate's *current role*.

Identity confidence and current-role freshness are separate. A report can know
who the person is while still warning that public employer/title data may lag.
"""
from __future__ import annotations

from ..models import InterviewerIn, PersonCandidate


def apply_freshness(candidate: PersonCandidate, interviewer: InterviewerIn) -> PersonCandidate:
    profile_text = (interviewer.profileText or "").strip()
    if profile_text and len(profile_text) > 20:
        candidate.currentRoleFreshness = "high"
        candidate.currentRoleStatus = "verified_from_user_profile_evidence"
        candidate.evidenceSignals.append("Current role refreshed from user-supplied profile evidence")
        if candidate.recommendedAction == "insufficient_evidence":
            candidate.recommendedAction = "use_with_caveat"
        return candidate

    if any("without company corroboration" in c.lower() for c in candidate.conflictingSignals):
        # Ambiguous person match should not be upgraded to a current-role claim.
        candidate.currentRoleFreshness = "unknown"
        candidate.currentRoleStatus = "unknown"
        return candidate

    if candidate.conflictingSignals and any("stale" in c.lower() or "previous" in c.lower() for c in candidate.conflictingSignals):
        candidate.currentRoleFreshness = "low"
        candidate.currentRoleStatus = "stale_public_data"
        return candidate

    if candidate.lastSeenDates:
        candidate.currentRoleFreshness = "medium"
        candidate.currentRoleStatus = "latest_public_data"
        return candidate

    if candidate.currentRoleStatus == "latest_public_data":
        candidate.currentRoleFreshness = "medium"
        return candidate

    candidate.currentRoleFreshness = candidate.currentRoleFreshness or "low"
    candidate.currentRoleStatus = candidate.currentRoleStatus or "stale_public_data"
    return candidate


def recommended_action_text(candidate: PersonCandidate) -> str:
    if candidate.currentRoleStatus == "verified_from_user_profile_evidence":
        return "Safe to use current title from supplied profile text"
    if candidate.identityConfidence in ("low", "unknown"):
        return "Treat this as a possible match and confirm identity before relying on it"
    if candidate.currentRoleStatus == "unknown":
        return "Use the professional themes, but do not assert the current title"
    if candidate.currentRoleFreshness in ("low", "unknown"):
        return "Confirm exact current title naturally during the call"
    return "Confirm exact current title naturally if it matters"
