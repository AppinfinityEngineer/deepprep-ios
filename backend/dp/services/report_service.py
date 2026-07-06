"""Report orchestration: search -> discovery -> scoring -> freshness -> synthesis."""
from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

from ..models import (
    CompanyBrief,
    FreeScanSummary,
    InterviewerDossier,
    InterviewerIn,
    LikelyQuestion,
    PersonCandidate,
    Report,
    SourceNote,
    TalkingPoint,
)
from . import candidate_ranker, company_resolver, cost_tracker, freshness, llm_provider, person_discovery
from .search_provider import SearchProvider


def hydrate_interviewer_evidence(
    interviewers: List[InterviewerIn],
    profile_url: Optional[str] = None,
    profile_text: Optional[str] = None,
    limit: int = 4,
) -> List[InterviewerIn]:
    """Attach top-level profile evidence to the primary interviewer for v1."""
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
    mode: str = "full",
) -> Tuple[SearchProvider, List[PersonCandidate], List[InterviewerIn], Dict, List[Dict]]:
    provider = SearchProvider()
    company_max = 2 if mode == "free_scan" else 4
    company_resolution = await company_resolver.resolve_company(company, provider, role=role, max_queries=company_max)
    hydrated = hydrate_interviewer_evidence(interviewers, profile_url, profile_text, limit=limit)
    candidates: List[PersonCandidate] = []
    discoveries: List[Dict] = []
    person_query_max = 4 if mode == "free_scan" else 8
    results_per_query = 3 if mode == "free_scan" else 4
    for iv in hydrated:
        discovery = await person_discovery.discover(
            iv,
            company,
            role,
            provider,
            max_queries=person_query_max,
            max_results_per_query=results_per_query,
        )
        cand = candidate_ranker.score_candidate(iv, company, role, discovery)
        cand = freshness.apply_freshness(cand, iv)
        candidates.append(cand)
        discoveries.append(discovery)
    return provider, candidates, hydrated, company_resolution, discoveries


def _match_label(conf: str) -> str:
    return {"high": "High", "medium": "Medium", "low": "Low", "unknown": "Unclear"}.get(conf, "Unclear")


def _status_label(status: str) -> str:
    return status.replace("_", " ").title().replace("From", "from")


def _free_freshness_note(primary: Optional[PersonCandidate]) -> str:
    if not primary:
        return "No interviewer match was available for freshness scoring."
    if primary.currentRoleStatus == "verified_from_user_profile_evidence":
        return "Current-role freshness was upgraded using user-supplied profile evidence."
    if primary.currentRoleStatus == "conflicting":
        return "Public sources conflict. Confirm the exact current title naturally before asserting it."
    if primary.identityConfidence in ("low", "unknown"):
        return "We found limited public evidence for this exact person/company match. Treat this as a preview, not a final confirmation."
    if primary.currentRoleFreshness in ("low", "unknown"):
        return "Public professional data may lag job moves. Confirm the exact current title naturally."
    return "Public professional sources were used for current-role freshness. Confirm naturally if the role matters."


def _source_notes(company_resolution: Dict, discoveries: List[Dict], profile_used: bool) -> List[SourceNote]:
    domains = set(company_resolution.get("sourceDomains", []))
    urls: List[str] = []
    for disc in discoveries:
        domains.update(disc.get("domains", []))
        urls.extend(disc.get("urls", []))
    notes = [
        SourceNote(
            label="Live public web search",
            detail=f"Reviewed public results across {len(domains)} source domain(s): {', '.join(sorted(domains)[:6]) or 'none returned'}.",
        )
    ]
    for url in urls[:3]:
        notes.append(SourceNote(label="Source", detail=url))
    if profile_used:
        notes.append(
            SourceNote(
                label="User-supplied profile evidence",
                detail="Profile text/URL was applied to the primary interviewer for current-role freshness.",
            )
        )
    return notes


def _search_powered_free_scan_data(
    company: str,
    role: str,
    company_resolution: Dict,
    primary: Optional[PersonCandidate],
    primary_discovery: Optional[Dict],
    llm_data: Dict,
) -> Dict:
    """Make free scan copy use live Tavily evidence even while LLM is mocked."""
    domains = company_resolution.get("sourceDomains", [])
    titles = company_resolution.get("topTitles", [])[:3]
    person_titles = (primary_discovery or {}).get("topTitles", [])[:3]
    insights: List[str] = []

    if domains:
        insights.append(f"DeepPrep reviewed live public results for {company} across {', '.join(domains[:3])}.")
    if primary:
        insights.append(
            f"Interviewer match is {_match_label(primary.identityConfidence).lower()} confidence ({primary.identityScore}/100) based on returned source evidence."
        )
        if primary.sourceDomains:
            insights.append(f"Professional signals were found on: {', '.join(primary.sourceDomains[:3])}.")
    if titles:
        insights.append(f"Company signal found: {titles[0][:110]}.")
    if person_titles:
        insights.append(f"Person signal found: {person_titles[0][:110]}.")

    while len(insights) < 3:
        fallback = (llm_data.get("keyInsights") or [])
        if len(fallback) > len(insights):
            insights.append(fallback[len(insights)])
        else:
            insights.append(f"Use the brief to connect your {role} experience to {company}'s current public signals.")

    likely_question = llm_data.get("likelyQuestion") or f"How would your {role} experience help {company} right now?"
    if primary and primary.currentRoleFreshness in ("low", "unknown"):
        talking_point = "Use the professional themes from the scan, but avoid asserting the exact current title unless the interviewer confirms it."
    elif primary and primary.currentRoleStatus == "verified_from_user_profile_evidence":
        talking_point = "Lead with role-relevant evidence from the supplied profile and connect it to one measurable work story."
    else:
        talking_point = llm_data.get("talkingPoint") or "Open with a specific, measurable example tied to the company context."

    return {
        "keyInsights": insights[:3],
        "likelyQuestion": likely_question,
        "talkingPoint": talking_point,
        "_provider": llm_data.get("_provider", "deterministic_search_preview"),
        "_model": llm_data.get("_model", "search-preview"),
        "_input_chars": llm_data.get("_input_chars", 0),
        "_output_chars": llm_data.get("_output_chars", 0),
    }


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
    provider, candidates, hydrated_interviewers, company_resolution, discoveries = await _run_pipeline(
        company, role, interviewers, limit=4, profile_url=profile_url, profile_text=profile_text, mode="full"
    )

    ctx = {
        "company": company,
        "role": role,
        "date": date,
        "jdText": jd_text,
        "companyResolution": company_resolution,
        "discoveries": discoveries,
        "candidates": [c.model_dump() for c in candidates],
    }
    data = await llm_provider.synthesize(ctx, mode="full")

    dossiers = _merge_dossiers(data.get("dossiers", []), candidates, hydrated_interviewers)
    cb = data.get("companyBrief", {})
    profile_used = bool(profile_url or profile_text)
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
        confidenceNotes=data.get("confidenceNotes", []) + [c.evidenceSignals[0] for c in candidates if c.evidenceSignals[:1]],
        freshnessNotes=data.get("freshnessNotes", []) + [_free_freshness_note(candidates[0] if candidates else None)],
        sourceNotes=_source_notes(company_resolution, discoveries, profile_used),
        cost=cost_tracker.estimate(
            data.get("_provider", "unknown"), data.get("_model", "unknown"),
            provider.query_count, provider.result_count,
            data.get("_input_chars", 0), data.get("_output_chars", 0), time.time() - start,
            getattr(provider, "credit_count", None),
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
    provider, candidates, hydrated_interviewers, company_resolution, discoveries = await _run_pipeline(
        company, role, interviewers, limit=1, profile_url=profile_url, profile_text=profile_text, mode="free_scan"
    )
    primary = candidates[0] if candidates else None
    primary_discovery = discoveries[0] if discoveries else None

    ctx = {
        "company": company,
        "role": role,
        "date": date,
        "jdText": jd_text,
        "companyResolution": company_resolution,
        "discoveries": discoveries,
        "candidates": [c.model_dump() for c in candidates],
    }
    llm_data = await llm_provider.synthesize(ctx, mode="free_scan")
    data = _search_powered_free_scan_data(company, role, company_resolution, primary, primary_discovery, llm_data)

    match_conf = primary.identityConfidence if primary else "unknown"
    match_pct = primary.identityScore if primary else 0
    fresh = primary.currentRoleFreshness if primary else "unknown"
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
    profile_used = bool(hydrated_interviewers and (hydrated_interviewers[0].linkedinUrl or hydrated_interviewers[0].profileText))
    report = Report(
        interviewId=interview_id,
        mode="free_scan",
        company=company,
        role=role,
        executiveSummary="Free Intel Scan preview. Unlock the full report for complete intelligence.",
        freeScanSummary=summary,
        confidenceNotes=[
            "This is a limited preview based on one interviewer and a reduced live-search query pack.",
            *(primary.evidenceSignals[:2] if primary else []),
        ],
        freshnessNotes=[note],
        sourceNotes=_source_notes(company_resolution, discoveries, profile_used),
        cost=cost_tracker.estimate(
            data.get("_provider", "unknown"), data.get("_model", "unknown"),
            provider.query_count, provider.result_count,
            data.get("_input_chars", 0), data.get("_output_chars", 0), time.time() - start,
            getattr(provider, "credit_count", None),
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
