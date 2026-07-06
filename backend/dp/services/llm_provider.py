"""LLM synthesis provider.

Uses the emergentintegrations LlmChat wrapper. Provider/model are configurable
via env (LLM_PROVIDER, OPENAI_MODEL, ANTHROPIC_MODEL). Uses a provider-specific
key if supplied, else the Emergent universal key.

TODO(branch-2): ThoughtSnap Labs — set OPENAI_API_KEY / ANTHROPIC_API_KEY in
env to drop the Emergent universal key for production.
"""
import json
import re
from typing import Dict

from emergentintegrations.llm.chat import LlmChat, UserMessage

from ..config import get_settings
from ..utils import new_id


class LLMConfigError(RuntimeError):
    pass


def _extract_json(text: str) -> Dict:
    text = text.strip()
    # Strip markdown code fences if present.
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in LLM output")
    return json.loads(text[start : end + 1])


def _system_message(mode: str) -> str:
    common = (
        "You are DeepPrep, a professional interview-intelligence assistant. "
        "You produce private interview-preparation briefs from publicly available "
        "professional information and user-supplied interview details. "
        "Be honest about confidence, freshness and uncertainty. "
        "Never invent private, sensitive, or unverifiable personal facts. "
        "Never use surveillance framing (no 'spy', 'stalk', 'find hidden info'). "
        "Frame everything as helpful, respectful interview preparation. "
        "Return ONLY valid minified JSON, no markdown, no commentary."
    )
    return common


def _full_prompt(ctx: Dict) -> str:
    return f"""Generate a FULL interview intelligence brief as JSON.

Interview context:
- Company: {ctx['company']}
- Role: {ctx['role']}
- Interview date: {ctx.get('date') or 'not provided'}
- Job description: {(ctx.get('jdText') or 'not provided')[:4000]}
- Candidate identity/freshness scoring (deterministic, use these badges verbatim):
{json.dumps(ctx.get('candidates', []), indent=0)}

Return JSON with EXACTLY these keys:
{{
 "executiveSummary": "2-3 sentence summary of the situation and edge",
 "companyBrief": {{"summary": "", "signals": ["3-5 concrete company signals"], "risks": ["2-3"], "opportunities": ["2-3"]}},
 "dossiers": [ {{
    "name": "", "title": "",
    "profileSummary": "grounded professional summary",
    "careerPath": ["3-4 plausible career-path bullets, clearly framed as likely/typical"],
    "likelyPriorities": ["3 priorities this person likely cares about"],
    "interviewStyle": "one sentence",
    "questionsTheyMayAsk": ["3-4 questions"],
    "goodTopics": ["3 topics to raise"],
    "avoid": ["2 things to be careful with"],
    "sourceNotes": ["how this was inferred"],
    "confidenceNotes": ["honest confidence caveats"]
 }} ] (one per interviewer, keep name/title matching input order),
 "likelyQuestions": [ {{"question":"", "why":"", "starAngle":"", "confidence":"high|medium|low"}} ] (5-6 items),
 "talkingPoints": [ {{"point":"", "advice":""}} ] (3-5 items),
 "dayOfBrief": "a condensed one-page day-of brief as plain text with short labelled lines: who you are meeting, what they care about, likely questions, what to say, what to avoid, final reminder",
 "confidenceNotes": ["2-3 overall confidence notes"],
 "freshnessNotes": ["2-3 freshness notes referencing whether public data may be stale"]
}}"""


def _free_prompt(ctx: Dict) -> str:
    first = (ctx.get("candidates") or [{}])[0]
    return f"""Generate a LIMITED free intel scan as JSON (this is a teaser, keep it short).

Company: {ctx['company']}
Role: {ctx['role']}
Primary interviewer (if any): {first.get('name', 'unknown')}
Job description: {(ctx.get('jdText') or 'not provided')[:1500]}

Return JSON with EXACTLY these keys:
{{
 "keyInsights": ["exactly 3 sharp insights about the company/role"],
 "likelyQuestion": "one likely interview question",
 "talkingPoint": "one smart talking point with brief practical advice"
}}"""


async def synthesize(ctx: Dict, mode: str) -> Dict:
    settings = get_settings()

    if settings.enable_mock_llm:
        return _mock_output(ctx, mode)

    if not settings.has_llm_key:
        # Explicit config error — never silently fake user-facing content.
        raise LLMConfigError(
            "No LLM key configured. Set OPENAI_API_KEY / ANTHROPIC_API_KEY / "
            "EMERGENT_LLM_KEY, or enable ENABLE_MOCK_LLM=true for dev."
        )

    provider, model, key = settings.resolved_llm()
    chat = (
        LlmChat(api_key=key, session_id=new_id(), system_message=_system_message(mode))
        .with_model(provider, model)
    )
    prompt = _free_prompt(ctx) if mode == "free_scan" else _full_prompt(ctx)
    resp = await chat.send_message(UserMessage(text=prompt))
    text = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    data = _extract_json(text)
    data["_provider"] = provider
    data["_model"] = model
    data["_input_chars"] = len(prompt)
    data["_output_chars"] = len(text)
    return data


def _mock_output(ctx: Dict, mode: str) -> Dict:
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
            "summary": f"{company} is a growth-stage company investing in its {role} function.",
            "signals": ["Scaling engineering", "Focus on data products", "Reliability emphasis"],
            "risks": ["Post-scale consolidation", "Legacy tech debt"],
            "opportunities": ["Own reliability", "Shape data strategy"],
        },
        "dossiers": [
            {
                "name": c.get("name", "Interviewer"),
                "title": c.get("possibleTitle") or "",
                "profileSummary": "Experienced leader in data & technology.",
                "careerPath": ["Director of Data & Technology", "Principal roles", "BSc Computer Science"],
                "likelyPriorities": ["Platform reliability", "Data product thinking", "Governance"],
                "interviewStyle": "Pragmatic and outcome-focused.",
                "questionsTheyMayAsk": ["Walk me through a reliability incident.", "How do you model data?"],
                "goodTopics": ["Reliability war stories", "Business outcomes"],
                "avoid": ["Pipeline-only framing"],
                "sourceNotes": ["Inferred from role context"],
                "confidenceNotes": ["Confirm exact current title during the call"],
            }
            for c in (ctx.get("candidates") or [{}])
        ],
        "likelyQuestions": [
            {"question": "How do you keep a data platform available while changing?", "why": "Core reliability concern", "starAngle": "Describe an incident you resolved", "confidence": "high"},
            {"question": "Walk me through a time you solved a reliability incident.", "why": "Behavioural depth", "starAngle": "STAR with measurable impact", "confidence": "high"},
        ],
        "talkingPoints": [
            {"point": "Share a reliability war story with measurable impact.", "advice": "Quantify the outcome."},
            {"point": "Talk about data product thinking, not just pipelines.", "advice": "Tie to business."},
        ],
        "dayOfBrief": "Who: hiring manager. Cares about: reliability. Questions: incidents. Say: impact stories. Avoid: pipeline-only. Reminder: stay calm.",
        "confidenceNotes": ["Identity confidence based on provided details."],
        "freshnessNotes": ["Public role data may be stale; confirm current title."],
        "_provider": "mock",
        "_model": "mock",
        "_input_chars": 500,
        "_output_chars": 1200,
    }
