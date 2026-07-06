"""Freshness scoring for a candidate's *current role*.

Kept separate from identity confidence: we may be very sure WHO the person is
but unsure whether their public current-role data is up to date.
"""
from ..models import PersonCandidate, InterviewerIn


def apply_freshness(candidate: PersonCandidate, interviewer: InterviewerIn) -> PersonCandidate:
    if interviewer.profileText and len(interviewer.profileText.strip()) > 20:
        candidate.currentRoleFreshness = "high"
        candidate.currentRoleStatus = "verified_from_user_profile_evidence"
        candidate.evidenceSignals.append("Current role verified from user-supplied profile text")
        if candidate.recommendedAction == "insufficient_evidence":
            candidate.recommendedAction = "use_with_caveat"
        return candidate

    if candidate.lastSeenDates:
        candidate.currentRoleFreshness = "medium"
        candidate.currentRoleStatus = "latest_public_data"
    else:
        candidate.currentRoleFreshness = "low"
        candidate.currentRoleStatus = "stale_public_data"

    if candidate.conflictingSignals:
        candidate.currentRoleStatus = "conflicting"
    return candidate


def recommended_action_text(candidate: PersonCandidate) -> str:
    if candidate.currentRoleStatus == "verified_from_user_profile_evidence":
        return "Safe to use current title from supplied profile text"
    if candidate.currentRoleFreshness in ("low", "unknown"):
        return "Confirm exact current title naturally during the call"
    return "Confirm exact current title naturally"
