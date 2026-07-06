"""Report orchestration: search -> discovery -> scoring -> freshness -> synthesis."""
import time
from typing import List, Optional, Tuple

from ..models import (
    InterviewerIn,
    PersonCandidate,
    Report,
    CompanyBrief,
    InterviewerDossier,
    LikelyQuestion,
    TalkingPoint,
    SourceNote,
    FreeScanSummary,
)
from . import company_resolver, person_discovery, candidate_ranker, freshness, cost_tracker, llm_provider
from .search_provider import SearchProvider


def hydrate_interviewer_evidence(
    interviewers: List[InterviewerIn],
    profile_url: Optional[str] = None,
    profile_text: Optional[str] = None,
    limit: int = 4,
) -> List[InterviewerIn]:
    """Attach top-level onboarding profile evidence to the primary interviewer.

    The mobile onboarding collects optional LinkedIn/profile evidence on a
    dedicated final step. For v1 this evidence is interpreted as applying to the
    first interviewer in the limited/free scan, unless that interviewer already
    has its own URL/text. This keeps the UX simple while ensuring the freshness
    layer receives the evidence that the user pasted.
    """
    cleaned = [iv for iv in interviewers[:limit] if iv.name.strip()]
    if not cleaned:
        return []

    if not (profile_url or profile_text):
        return cleaned

    first = cleaned[0].model_copy(deep=True)
    if profile_url and not first.linkedinUrl:
        first.linkedinUrl = profile_url.strip()
    if profile_text and not first.profileText:
        first.profileText = profile_text.strip()
    return [first, *cleaned[1:]]


async def _run_pipeline(
    company: str,
    role: str,
    interviewers: List[InterviewerIn],
    limit: int,
    profile_url: Optional[str] = None,
    profile_text: Optional[str] = None,
) -> Tuple[SearchProvider, List[PersonCandidate], List[InterviewerIn]]:
    provider = SearchProvider()
    await company_resolver.resolve_company(company, provider)
    hydrated = hydrate_interviewer_evidence(interviewers, profile_url, profile_text, limit=limit)
    candidates: List[PersonCandidate] = []
    for iv in hydrated:
        discovery = await person_discovery.discover(iv, company, role, provider)
        cand = candidate_ranker.score_candidate(iv, company, role, discovery)
        cand = freshness.apply_freshness(cand, iv)
        candidates.append(cand)
    return provider, candidates, hydrated


def _match_label(conf: str) -> str:
    return {"high": "High", "medium": "Medium", "low": "Low", "unknown": "Unclear"}.get(conf, "Unclear")


def _status_label(status: str) -> str:
    return status.replace("_", " ")


def _free_freshness_note(primary: Optional[PersonCandidate]) -> str:
    if not primary:
        return "No interviewer match was available for freshness scoring."
    if primary.currentRoleStatus == "verified_from_user_profile_evidence":
        return "Current-role freshness was upgraded using user-supplied profile evidence."
    if primary.currentRoleStatus == "conflicting":
        return "Public sources conflict. Confirm the exact current title naturally before asserting it."
    if primary.currentRoleFreshness in ("low", "unknown"):
        return "Public professional data may lag job moves. Confirm the exact current title naturally."
    return "Public professional sources were used for current-role freshness. Confirm naturally if the role matters."


async def build_full_report(
    interview_id: str,
    company: str,
    role: str,
    jd_text,
    date,
    interviewers: List[InterviewerIn],
    profile_url: Optional[str] = None,
    profile_text: Optional[str] = None,
) -> Report:
    start = time.time()
    provider, candidates, hydrated_interviewers = await _run_pipeline(
        company, role, interviewers, limit=4, profile_url=profile_url, profile_text=profile_text
    )

    ctx = {
        "company": company,
        "role": role,
        "date": date,
        "jdText": jd_text,
        "candidates": [c.model_dump() for c in candidates],
    }
    data = await llm_provider.synthesize(ctx, mode="full")

    dossiers = _merge_dossiers(data.get("dossiers", []), candidates, hydrated_interviewers)
    cb = data.get("companyBrief", {})
    source_notes = [
        SourceNote(
            label="Public professional data",
            detail="Signals synthesised from public web research and user-supplied interview details.",
        )
    ]
    if profile_url or profile_text:
        source_notes.append(
            SourceNote(
                label="User-supplied profile evidence",
                detail="Top-level profile evidence was applied to the primary interviewer for current-role freshness.",
            )
        )

    report = Report(
        interviewId=interview_id,
        mode="full",
        company=company,
        role=role,
        executiveSummary=data.get("executiveSummary", ""),
        companyBrief=CompanyBrief(
            summary=cb.get("summary", ""),
            signals=cb.get("signals", []),
            risks=cb.get("risks", []),
            opportunities=cb.get("opportunities", []),
        ),
        dossiers=dossiers,
        likelyQuestions=[LikelyQuestion(**_clean_q(q)) for q in data.get("likelyQuestions", [])],
        talkingPoints=[TalkingPoint(point=t.get("point", ""), advice=t.get("advice", "")) for t in data.get("talkingPoints", [])],
        dayOfBrief=data.get("dayOfBrief", ""),
        confidenceNotes=data.get("confidenceNotes", []),
        freshnessNotes=data.get("freshnessNotes", []) + [_free_freshness_note(candidates[0] if candidates else None)],
        sourceNotes=source_notes,
        cost=cost_tracker.estimate(
            data.get("_provider", "unknown"), data.get("_model", "unknown"),
            provider.query_count, provider.result_count,
            data.get("_input_chars", 0), data.get("_output_chars", 0), time.time() - start,
        ),
    )
    return report


async def build_free_scan_report(
    interview_id: str,
    company: str,
    role: str,
    jd_text,
    date,
    interviewers: List[InterviewerIn],
    profile_url: Optional[str] = None,
    profile_text: Optional[str] = None,
) -> Report:
    """Limited scan: 1 company, 1 interviewer, reduced queries + output."""
    start = time.time()
    provider, candidates, hydrated_interviewers = await _run_pipeline(
        company, role, interviewers, limit=1, profile_url=profile_url, profile_text=profile_text
    )
    primary = candidates[0] if candidates else None

    ctx = {
        "company": company,
        "role": role,
        "date": date,
        "jdText": jd_text,
        "candidates": [c.model_dump() for c in candidates],
    }
    data = await llm_provider.synthesize(ctx, mode="free_scan")

    match_conf = primary.identityConfidence if primary else "medium"
    match_pct = primary.identityScore if primary else 78
    fresh = primary.currentRoleFreshness if primary else "medium"
    status = primary.currentRoleStatus if primary else "unknown"
    evidence_used = status == "verified_from_user_profile_evidence"
    action = freshness.recommended_action_text(primary) if primary else "Confirm exact current title naturally"
    note = _free_freshness_note(primary)

    summary = FreeScanSummary(
        matchConfidence=match_pct,
        matchLabel=_match_label(match_conf),
        roleFreshness=_match_label(fresh),
        currentRoleStatus=_status_label(status),
        recommendedAction=action,
        profileEvidenceUsed=evidence_used,
        freshnessNote=note,
        keyInsights=data.get("keyInsights", [])[:3],
        likelyQuestion=data.get("likelyQuestion", ""),
        talkingPoint=data.get("talkingPoint", ""),
    )
    source_notes = []
    if hydrated_interviewers and (hydrated_interviewers[0].linkedinUrl or hydrated_interviewers[0].profileText):
        source_notes.append(SourceNote(label="Profile evidence", detail="User-supplied profile evidence was used for current-role freshness."))
    report = Report(
        interviewId=interview_id,
        mode="free_scan",
        company=company,
        role=role,
        executiveSummary="Free Intel Scan preview. Unlock the full report for complete intelligence.",
        freeScanSummary=summary,
        confidenceNotes=["This is a limited preview based on a single interviewer and reduced research."],
        freshnessNotes=[note],
        sourceNotes=source_notes,
        cost=cost_tracker.estimate(
            data.get("_provider", "unknown"), data.get("_model", "unknown"),
            provider.query_count, provider.result_count,
            data.get("_input_chars", 0), data.get("_output_chars", 0), time.time() - start,
        ),
    )
    return report


def _clean_q(q: dict) -> dict:
    conf = q.get("confidence", "medium")
    if conf not in ("high", "medium", "low"):
        conf = "medium"
    return {
        "question": q.get("question", ""),
        "why": q.get("why", ""),
        "starAngle": q.get("starAngle", ""),
        "confidence": conf,
    }


def _merge_dossiers(narr: list, candidates: List[PersonCandidate], interviewers: List[InterviewerIn]) -> List[InterviewerDossier]:
    dossiers: List[InterviewerDossier] = []
    for i, cand in enumerate(candidates):
        n = narr[i] if i < len(narr) else {}
        iv = interviewers[i] if i < len(interviewers) else None
        source_notes = n.get("sourceNotes", []) + [f"{len(cand.sourceDomains)} source domain(s) reviewed"]
        if iv and (iv.linkedinUrl or iv.profileText):
            source_notes.append("User-supplied profile evidence applied to current-role freshness")
        dossiers.append(
            InterviewerDossier(
                interviewerId=getattr(iv, "id", None) if iv else None,
                name=cand.name,
                title=cand.possibleTitle,
                matchConfidence=_match_label(cand.identityConfidence),
                roleFreshness=_match_label(cand.currentRoleFreshness),
                currentRoleStatus=_status_label(cand.currentRoleStatus),
                recommendedAction=freshness.recommended_action_text(cand),
                profileSummary=n.get("profileSummary", ""),
                careerPath=n.get("careerPath", []),
                likelyPriorities=n.get("likelyPriorities", []),
                interviewStyle=n.get("interviewStyle", ""),
                questionsTheyMayAsk=n.get("questionsTheyMayAsk", []),
                goodTopics=n.get("goodTopics", []),
                avoid=n.get("avoid", []),
                sourceNotes=source_notes,
                confidenceNotes=n.get("confidenceNotes", []) + cand.evidenceSignals[:2],
            )
        )
    return dossiers
