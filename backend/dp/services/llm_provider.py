"""LLM synthesis provider for DeepPrep.

Branch 5 wires real OpenAI/Anthropic synthesis while preserving the dev-only
mock path behind ENABLE_MOCK_LLM=true. The service returns structured JSON only
and performs defensive schema normalisation so report orchestration can remain
stable during live validation.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

import httpx

from ..config import get_settings


class LLMConfigError(RuntimeError):
    pass


_TIMEOUT_SECONDS = 35.0


def _extract_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in LLM output")
    return json.loads(text[start : end + 1])


def _system_message(mode: str) -> str:
    return (
        "You are DeepPrep, a professional interview-preparation assistant. "
        "You create private interview briefs from user-supplied interview details, "
        "job descriptions, and public professional/company signals. "
        "Use only the evidence provided in the prompt. Do not invent private facts, "
        "personal sensitive attributes, contact details, family information, home locations, "
        "or unsupported current-role claims. If public evidence is stale, unclear, or conflicting, "
        "state that plainly and frame the advice as interview preparation. "
        "Never use surveillance, spy, stalking, hidden-info, background-check, OSINT, or doxxing framing. "
        "Return ONLY valid minified JSON, no markdown, no commentary."
    )


def _source_pack(ctx: Dict[str, Any]) -> str:
    company_resolution = ctx.get("companyResolution") or {}
    discoveries = ctx.get("discoveries") or []
    candidates = ctx.get("candidates") or []

    compact_discoveries: List[Dict[str, Any]] = []
    for d in discoveries[:3]:
        compact_discoveries.append(
            {
                "domains": d.get("domains", [])[:6],
                "sourceTypes": d.get("sourceTypes", [])[:5],
                "topTitles": d.get("topTitles", [])[:4],
                "topSnippets": d.get("topSnippets", [])[:4],
                "nameHitCount": d.get("nameHitCount", 0),
                "companyHitCount": d.get("companyHitCount", 0),
                "titleHitCount": d.get("titleHitCount", 0),
                "roleHitCount": d.get("roleHitCount", 0),
                "freshnessSignals": d.get("freshnessSignals", [])[:3],
                "staleSignals": d.get("staleSignals", [])[:3],
                "conflictSignals": d.get("conflictSignals", [])[:3],
            }
        )

    return json.dumps(
        {
            "companyResolution": {
                "resolved": company_resolution.get("resolved"),
                "sourceDomains": company_resolution.get("sourceDomains", [])[:8],
                "topTitles": company_resolution.get("topTitles", [])[:5],
                "snippets": company_resolution.get("snippets", [])[:5],
            },
            "candidateScores": candidates,
            "discoveries": compact_discoveries,
        },
        ensure_ascii=False,
    )


def _full_prompt(ctx: Dict[str, Any]) -> str:
    return f"""Generate a FULL paid-quality interview preparation report as JSON.

Interview context:
- Company: {ctx['company']}
- Role: {ctx['role']}
- Interview date: {ctx.get('date') or 'not provided'}
- Job description: {(ctx.get('jdText') or 'not provided')[:3000]}

Evidence pack from live public search and deterministic scoring:
{_source_pack(ctx)}

Rules:
- Ground claims in the evidence pack or mark them as inferred/uncertain.
- Use deterministic candidate badges exactly for match/freshness wording.
- Separate identity match confidence from current-role freshness.
- Do not assert a current title if currentRoleStatus is unknown/stale/conflicting.
- Do not list certifications, employers, current roles, or biographical facts unless they appear in the supplied titles/snippets or job description.
- When evidence is strong but source freshness is unclear, keep the useful advice but soften the phrasing: "public results suggest", "signals point to", "prepare for".
- Write practical interview-prep advice the candidate can actually use.
- Avoid creepy/surveillance language.

Return JSON with EXACTLY these keys:
{{
 "executiveSummary": "2-3 sentence summary of the interview situation and best preparation edge",
 "companyBrief": {{"summary": "", "signals": ["3-5 concrete company/role signals"], "risks": ["2-3 practical interview risks"], "opportunities": ["2-3 angles the candidate can use"]}},
 "dossiers": [ {{
    "name": "", "title": "",
    "profileSummary": "grounded professional summary using uncertainty where needed",
    "careerPath": ["3-4 evidence-based or clearly inferred career-path bullets"],
    "likelyPriorities": ["3 likely work/interview priorities"],
    "interviewStyle": "one sentence, framed as inferred",
    "questionsTheyMayAsk": ["3-4 likely questions"],
    "goodTopics": ["3 topics to raise"],
    "avoid": ["2 things to avoid or phrase carefully"],
    "sourceNotes": ["how this was inferred from sources/scoring"],
    "confidenceNotes": ["honest confidence caveats"]
 }} ],
 "likelyQuestions": [ {{"question":"", "why":"", "starAngle":"", "confidence":"high|medium|low"}} ],
 "talkingPoints": [ {{"point":"", "advice":""}} ],
 "dayOfBrief": "plain text one-page day-of brief with short labelled lines: who you are meeting, what they may care about, likely questions, what to say, what to avoid, final reminder",
 "confidenceNotes": ["2-4 overall confidence notes"],
 "freshnessNotes": ["2-4 freshness notes, including stale/unclear public data caveats"]
}}"""


def _free_prompt(ctx: Dict[str, Any]) -> str:
    return f"""Generate a LIMITED free interview-prep scan as JSON.

Company: {ctx['company']}
Role: {ctx['role']}
Evidence pack:
{_source_pack(ctx)}

Rules:
- Keep it short and conversion-oriented.
- Use public evidence only.
- Do not overclaim identity or current title.

Return JSON with EXACTLY these keys:
{{
 "keyInsights": ["exactly 3 sharp but cautious insights"],
 "likelyQuestion": "one likely interview question",
 "talkingPoint": "one smart talking point with brief practical advice"
}}"""


async def synthesize(ctx: Dict[str, Any], mode: str) -> Dict[str, Any]:
    settings = get_settings()

    if settings.enable_mock_llm:
        return _mock_output(ctx, mode)

    if not settings.has_llm_key:
        raise LLMConfigError(
            "No LLM key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, "
            "or enable ENABLE_MOCK_LLM=true for local development."
        )

    provider, model, key = settings.resolved_llm()
    prompt = _free_prompt(ctx) if mode == "free_scan" else _full_prompt(ctx)
    input_chars = len(_system_message(mode)) + len(prompt)

    try:
        if provider == "anthropic":
            raw = await _call_anthropic(key, model, _system_message(mode), prompt, mode)
        else:
            raw = await _call_openai(key, model, _system_message(mode), prompt, mode)
        data = _extract_json(raw)
    except httpx.HTTPStatusError as e:
        body = e.response.text[:500] if e.response is not None else ""
        code = e.response.status_code if e.response is not None else "unknown"
        raise LLMConfigError(f"LLM provider returned HTTP {code}: {body}") from e
    except httpx.TimeoutException as e:
        raise LLMConfigError("LLM provider timed out") from e
    except Exception as e:
        raise LLMConfigError(f"LLM synthesis failed: {e}") from e

    data = _normalise_free(data) if mode == "free_scan" else _normalise_full(data, ctx)
    data["_provider"] = provider
    data["_model"] = model
    data["_input_chars"] = input_chars
    data["_output_chars"] = len(json.dumps(data, ensure_ascii=False))
    return data


async def _call_openai(key: str, model: str, system: str, prompt: str, mode: str) -> str:
    max_tokens = 700 if mode == "free_scan" else 2100
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        body = resp.json()
    return body["choices"][0]["message"]["content"]


async def _call_anthropic(key: str, model: str, system: str, prompt: str, mode: str) -> str:
    max_tokens = 700 if mode == "free_scan" else 2100
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        body = resp.json()
    parts = body.get("content", [])
    return "".join(p.get("text", "") for p in parts if p.get("type") == "text")


def _normalise_free(data: Dict[str, Any]) -> Dict[str, Any]:
    insights = _list_of_str(data.get("keyInsights"), 3)
    while len(insights) < 3:
        insights.append("Use the interview brief to connect your experience to the company context.")
    return {
        "keyInsights": insights[:3],
        "likelyQuestion": _str(data.get("likelyQuestion"), "How would your experience help in this role right now?"),
        "talkingPoint": _str(data.get("talkingPoint"), "Lead with a measurable work story tied to the company context."),
    }


def _normalise_full(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    candidates = ctx.get("candidates") or []
    raw_dossiers = data.get("dossiers") if isinstance(data.get("dossiers"), list) else []
    dossiers: List[Dict[str, Any]] = []
    for i, cand in enumerate(candidates):
        raw = raw_dossiers[i] if i < len(raw_dossiers) and isinstance(raw_dossiers[i], dict) else {}
        dossiers.append(
            {
                "name": _str(raw.get("name"), cand.get("name", "Interviewer")),
                "title": _str(raw.get("title"), cand.get("possibleTitle", "")),
                "profileSummary": _str(raw.get("profileSummary"), "Professional context is limited; use broad role-relevant preparation themes."),
                "careerPath": _list_of_str(raw.get("careerPath"), 4),
                "likelyPriorities": _list_of_str(raw.get("likelyPriorities"), 3),
                "interviewStyle": _str(raw.get("interviewStyle"), "Likely practical and evidence-led; treat as inferred."),
                "questionsTheyMayAsk": _list_of_str(raw.get("questionsTheyMayAsk"), 4),
                "goodTopics": _list_of_str(raw.get("goodTopics"), 3),
                "avoid": _list_of_str(raw.get("avoid"), 2),
                "sourceNotes": _list_of_str(raw.get("sourceNotes"), 3),
                "confidenceNotes": _list_of_str(raw.get("confidenceNotes"), 3),
            }
        )
    while not dossiers:
        dossiers.append(
            {
                "name": "Interviewer",
                "title": "",
                "profileSummary": "No interviewer profile evidence was supplied; prepare from company and role context.",
                "careerPath": [],
                "likelyPriorities": ["Evidence of impact", "Role fit", "Communication under uncertainty"],
                "interviewStyle": "Unknown; prepare concise examples and clarifying questions.",
                "questionsTheyMayAsk": ["Tell me about a relevant project.", "How do you handle ambiguity?", "Why this company?"],
                "goodTopics": ["Measurable outcomes", "Collaboration", "Learning curve"],
                "avoid": ["Unsupported claims", "Overly generic answers"],
                "sourceNotes": ["Generated from company and role context only"],
                "confidenceNotes": ["No person-specific evidence available"],
            }
        )

    cb = data.get("companyBrief") if isinstance(data.get("companyBrief"), dict) else {}
    likely = data.get("likelyQuestions") if isinstance(data.get("likelyQuestions"), list) else []
    cleaned_questions = []
    for q in likely[:8]:
        if not isinstance(q, dict):
            continue
        conf = q.get("confidence") if q.get("confidence") in ("high", "medium", "low") else "medium"
        cleaned_questions.append(
            {
                "question": _str(q.get("question"), "Tell me about a relevant example."),
                "why": _str(q.get("why"), "Relevant to the role."),
                "starAngle": _str(q.get("starAngle"), "Use Situation, Task, Action, Result with measurable outcome."),
                "confidence": conf,
            }
        )
    while len(cleaned_questions) < 5:
        cleaned_questions.append(
            {
                "question": f"How would you approach a key challenge as {ctx.get('role', 'this role')}?",
                "why": "Tests role fit and practical thinking.",
                "starAngle": "Use a comparable past project and quantify the result.",
                "confidence": "medium",
            }
        )

    talking = data.get("talkingPoints") if isinstance(data.get("talkingPoints"), list) else []
    cleaned_talking = []
    for t in talking[:6]:
        if isinstance(t, dict):
            cleaned_talking.append({"point": _str(t.get("point"), "Measurable impact"), "advice": _str(t.get("advice"), "Tie it to the role.")})
        elif isinstance(t, str):
            cleaned_talking.append({"point": t, "advice": "Tie it to the role."})
    while len(cleaned_talking) < 3:
        cleaned_talking.append({"point": "Lead with measurable impact", "advice": "Use concrete numbers and trade-offs."})

    return {
        "executiveSummary": _str(data.get("executiveSummary"), f"Prepare for {ctx.get('role')} at {ctx.get('company')} with concrete evidence and cautious use of public-source context."),
        "companyBrief": {
            "summary": _str(cb.get("summary"), f"Public signals were reviewed for {ctx.get('company')}."),
            "signals": _list_of_str(cb.get("signals"), 5),
            "risks": _list_of_str(cb.get("risks"), 3),
            "opportunities": _list_of_str(cb.get("opportunities"), 3),
        },
        "dossiers": dossiers,
        "likelyQuestions": cleaned_questions,
        "talkingPoints": cleaned_talking,
        "dayOfBrief": _str(data.get("dayOfBrief"), "Who: interview panel. Cares about: role fit and practical impact. Say: concise measurable examples. Avoid: unsupported claims. Reminder: clarify assumptions."),
        "confidenceNotes": _list_of_str(data.get("confidenceNotes"), 4),
        "freshnessNotes": _list_of_str(data.get("freshnessNotes"), 4),
    }


def _str(value: Any, fallback: str = "") -> str:
    if isinstance(value, str):
        clean = " ".join(value.split())
        return clean or fallback
    return fallback


def _list_of_str(value: Any, limit: int) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str):
            clean = " ".join(item.split())
        elif isinstance(item, dict):
            clean = " ".join(str(v) for v in item.values() if isinstance(v, (str, int, float))).strip()
        else:
            clean = ""
        if clean:
            out.append(clean)
        if len(out) >= limit:
            break
    return out


def _mock_output(ctx: Dict[str, Any], mode: str) -> Dict[str, Any]:
    """Dev-only fixtures. Only used when ENABLE_MOCK_LLM=true."""
    company = ctx["company"]
    role = ctx["role"]
    if mode == "free_scan":
        return {
            "keyInsights": [
                f"{company} is scaling its {role} function.",
                "Recent activity suggests hiring for growth and reliability.",
                "Public signals indicate a data/product-focused culture.",
            ],
            "likelyQuestion": "How would you keep a data platform reliable while growing?",
            "talkingPoint": "Share a reliability story with measurable impact.",
            "_provider": "mock",
            "_model": "mock",
            "_input_chars": 200,
            "_output_chars": 400,
        }
    return {
        "executiveSummary": f"You're interviewing for {role} at {company}. Lead with reliability and business impact.",
        "companyBrief": {
            "summary": f"{company} is investing in its {role} function.",
            "signals": ["Engineering/data signals reviewed", "Reliability emphasis", "Role-relevant public context"],
            "risks": ["Public information may be stale", "Panel priorities may differ from source signals"],
            "opportunities": ["Show measurable impact", "Ask high-quality context questions"],
        },
        "dossiers": [
            {
                "name": c.get("name", "Interviewer"),
                "title": c.get("possibleTitle") or "",
                "profileSummary": "Experienced professional context inferred from role and public signals.",
                "careerPath": ["Public source evidence reviewed", "Current-role freshness should be confirmed"],
                "likelyPriorities": ["Practical delivery", "Reliable systems", "Clear communication"],
                "interviewStyle": "Likely pragmatic and outcome-focused; treat as inferred.",
                "questionsTheyMayAsk": ["Walk me through a relevant project.", "How did you handle a reliability issue?"],
                "goodTopics": ["Impact metrics", "Trade-offs", "Collaboration"],
                "avoid": ["Unsupported current-title claims", "Generic answers"],
                "sourceNotes": ["Inferred from supplied details and public source categories"],
                "confidenceNotes": ["Confirm exact current title during the call"],
            }
            for c in (ctx.get("candidates") or [{}])
        ],
        "likelyQuestions": [
            {"question": "How do you keep a data platform reliable while changing?", "why": "Core reliability concern", "starAngle": "Describe an incident you resolved", "confidence": "high"},
            {"question": "Walk me through a time you solved a reliability incident.", "why": "Behavioural depth", "starAngle": "STAR with measurable impact", "confidence": "high"},
        ],
        "talkingPoints": [
            {"point": "Share a reliability war story with measurable impact.", "advice": "Quantify the outcome."},
            {"point": "Talk about data product thinking, not just pipelines.", "advice": "Tie to business."},
        ],
        "dayOfBrief": "Who: hiring panel. Cares about: practical impact. Questions: incidents and trade-offs. Say: measured outcomes. Avoid: overclaiming. Reminder: stay calm.",
        "confidenceNotes": ["Identity confidence based on provided details."],
        "freshnessNotes": ["Public role data may be stale; confirm current title."],
        "_provider": "mock",
        "_model": "mock",
        "_input_chars": 500,
        "_output_chars": 1200,
    }
