"""Report orchestration: search -> discovery -> scoring -> freshness -> synthesis."""
import time
from typing import List, Tuple

from ..models import (
    InterviewerIn,
    PersonCandidate,
    Report,
    ReportCost,
    CompanyBrief,
    InterviewerDossier,
    LikelyQuestion,
    TalkingPoint,
    SourceNote,
    FreeScanSummary,
)
from . import company_resolver, person_discovery, candidate_ranker, freshness, cost_tracker, llm_provider
from .search_provider import SearchProvider


async def _run_pipeline(
    company: str, role: str, interviewers: List[InterviewerIn], limit: int
) -> Tuple[SearchProvider, List[PersonCandidate]]:
    provider = SearchProvider()
    await company_resolver.resolve_company(company, provider)
    candidates: List[PersonCandidate] = []
    for iv in interviewers[:limit]:
        discovery = await person_discovery.discover(iv, company, role, provider)
        cand = candidate_ranker.score_candidate(iv, company, role, discovery)
        cand = freshness.apply_freshness(cand, iv)
        candidates.append(cand)
    return provider, candidates


def _match_label(conf: str) -> str:
    return {"high": "High", "medium": "Medium", "low": "Low", "unknown": "Unclear"}.get(conf, "Unclear")


async def build_full_report(
    interview_id: str, company: str, role: str, jd_text, date, interviewers: List[InterviewerIn]
) -> Report:
    start = time.time()
    provider, candidates = await _run_pipeline(company, role, interviewers, limit=4)

    ctx = {
        "company": company,
        "role": role,
        "date": date,
        "jdText": jd_text,
        "candidates": [c.model_dump() for c in candidates],
    }
    data = await llm_provider.synthesize(ctx, mode="full")

    dossiers = _merge_dossiers(data.get("dossiers", []), candidates, interviewers)
    cb = data.get("companyBrief", {})
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
        freshnessNotes=data.get("freshnessNotes", []),
        sourceNotes=[SourceNote(label="Public professional data", detail="Signals synthesised from public web research and user-supplied details.")],
        cost=cost_tracker.estimate(
            data.get("_provider", "unknown"), data.get("_model", "unknown"),
            provider.query_count, provider.result_count,
            data.get("_input_chars", 0), data.get("_output_chars", 0), time.time() - start,
        ),
    )
    return report


async def build_free_scan_report(
    interview_id: str, company: str, role: str, jd_text, date, interviewers: List[InterviewerIn]
) -> Report:
    """Limited scan: 1 company, 1 interviewer, reduced queries + output."""
    start = time.time()
    provider, candidates = await _run_pipeline(company, role, interviewers, limit=1)
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

    summary = FreeScanSummary(
        matchConfidence=match_pct,
        matchLabel=_match_label(match_conf),
        roleFreshness=_match_label(fresh),
        keyInsights=data.get("keyInsights", [])[:3],
        likelyQuestion=data.get("likelyQuestion", ""),
        talkingPoint=data.get("talkingPoint", ""),
    )
    report = Report(
        interviewId=interview_id,
        mode="free_scan",
        company=company,
        role=role,
        executiveSummary="Free Intel Scan preview. Unlock the full report for complete intelligence.",
        freeScanSummary=summary,
        confidenceNotes=["This is a limited preview based on a single interviewer and reduced research."],
        freshnessNotes=["Full report checks freshness across all interviewers."],
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
        dossiers.append(
            InterviewerDossier(
                interviewerId=getattr(iv, "id", None) if iv else None,
                name=cand.name,
                title=cand.possibleTitle,
                matchConfidence=_match_label(cand.identityConfidence),
                roleFreshness=_match_label(cand.currentRoleFreshness),
                currentRoleStatus=cand.currentRoleStatus.replace("_", " "),
                recommendedAction=freshness.recommended_action_text(cand),
                profileSummary=n.get("profileSummary", ""),
                careerPath=n.get("careerPath", []),
                likelyPriorities=n.get("likelyPriorities", []),
                interviewStyle=n.get("interviewStyle", ""),
                questionsTheyMayAsk=n.get("questionsTheyMayAsk", []),
                goodTopics=n.get("goodTopics", []),
                avoid=n.get("avoid", []),
                sourceNotes=n.get("sourceNotes", []) + [f"{len(cand.sourceDomains)} source domain(s) reviewed"],
                confidenceNotes=n.get("confidenceNotes", []) + cand.evidenceSignals[:2],
            )
        )
    return dossiers
