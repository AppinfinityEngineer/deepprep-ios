"""Pydantic models for DeepPrep. IDs are string UUIDs (stored as `_id`)."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

from .utils import new_id, now_iso


# ---------------- Core domain ----------------
class Interviewer(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    title: Optional[str] = None
    linkedinUrl: Optional[str] = None
    profileText: Optional[str] = None
    notes: Optional[str] = None


class Interview(BaseModel):
    id: str = Field(default_factory=new_id)
    company: str
    role: str
    jdText: Optional[str] = None
    date: Optional[str] = None
    interviewers: List[Interviewer] = Field(default_factory=list)
    reportId: Optional[str] = None
    status: Literal["draft", "free_scan", "generating", "ready", "failed"] = "draft"
    createdAt: str = Field(default_factory=now_iso)
    updatedAt: str = Field(default_factory=now_iso)


class PersonCandidate(BaseModel):
    candidateId: str = Field(default_factory=new_id)
    name: str
    possibleTitle: Optional[str] = None
    possibleCompany: Optional[str] = None
    possibleLocation: Optional[str] = None
    profileImageUrl: Optional[str] = None
    profileUrls: List[str] = Field(default_factory=list)
    sourceUrls: List[str] = Field(default_factory=list)
    sourceDomains: List[str] = Field(default_factory=list)
    identityScore: int = 0
    identityConfidence: Literal["high", "medium", "low", "unknown"] = "unknown"
    currentRoleFreshness: Literal["high", "medium", "low", "unknown"] = "unknown"
    currentRoleStatus: Literal[
        "verified_from_user_profile_evidence",
        "latest_public_data",
        "stale_public_data",
        "conflicting",
        "unknown",
    ] = "unknown"
    evidenceSignals: List[str] = Field(default_factory=list)
    conflictingSignals: List[str] = Field(default_factory=list)
    lastSeenDates: List[str] = Field(default_factory=list)
    recommendedAction: Literal[
        "auto_accept", "use_with_caveat", "ask_user_to_confirm", "insufficient_evidence"
    ] = "insufficient_evidence"


# ---------------- Report sub-models ----------------
class FreeScanSummary(BaseModel):
    matchConfidence: int
    matchLabel: str
    roleFreshness: str
    currentRoleStatus: str = "unknown"
    recommendedAction: str = "Confirm exact current title naturally"
    profileEvidenceUsed: bool = False
    freshnessNote: Optional[str] = None
    keyInsights: List[str]
    likelyQuestion: str
    talkingPoint: str


class CompanyBrief(BaseModel):
    summary: str
    signals: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)


class InterviewerDossier(BaseModel):
    interviewerId: Optional[str] = None
    name: str
    title: Optional[str] = None
    profileImageUrl: Optional[str] = None
    matchConfidence: str
    roleFreshness: str
    currentRoleStatus: str
    recommendedAction: str
    profileSummary: str
    careerPath: List[str] = Field(default_factory=list)
    likelyPriorities: List[str] = Field(default_factory=list)
    interviewStyle: str = ""
    questionsTheyMayAsk: List[str] = Field(default_factory=list)
    goodTopics: List[str] = Field(default_factory=list)
    avoid: List[str] = Field(default_factory=list)
    sourceNotes: List[str] = Field(default_factory=list)
    confidenceNotes: List[str] = Field(default_factory=list)


class LikelyQuestion(BaseModel):
    question: str
    why: str
    starAngle: str
    confidence: Literal["high", "medium", "low"] = "medium"


class TalkingPoint(BaseModel):
    point: str
    advice: str


class SourceNote(BaseModel):
    label: str
    detail: str


class ReportCost(BaseModel):
    searchQueryCount: int = 0
    searchResultCount: int = 0
    llmProvider: Optional[str] = None
    llmModel: Optional[str] = None
    inputTokens: Optional[int] = None
    outputTokens: Optional[int] = None
    estimatedSearchCostGbp: float = 0.0
    estimatedLlmCostGbp: float = 0.0
    estimatedTotalCostGbp: float = 0.0
    generationSeconds: float = 0.0


class Report(BaseModel):
    id: str = Field(default_factory=new_id)
    interviewId: str
    generatedAt: str = Field(default_factory=now_iso)
    mode: Literal["free_scan", "full"] = "full"
    company: str
    role: str
    executiveSummary: str = ""
    freeScanSummary: Optional[FreeScanSummary] = None
    companyBrief: CompanyBrief = Field(default_factory=lambda: CompanyBrief(summary=""))
    dossiers: List[InterviewerDossier] = Field(default_factory=list)
    likelyQuestions: List[LikelyQuestion] = Field(default_factory=list)
    talkingPoints: List[TalkingPoint] = Field(default_factory=list)
    dayOfBrief: str = ""
    confidenceNotes: List[str] = Field(default_factory=list)
    freshnessNotes: List[str] = Field(default_factory=list)
    sourceNotes: List[SourceNote] = Field(default_factory=list)
    cost: ReportCost = Field(default_factory=ReportCost)


# ---------------- Request payloads ----------------
class InterviewerIn(BaseModel):
    name: str
    title: Optional[str] = None
    linkedinUrl: Optional[str] = None
    profileText: Optional[str] = None


class FreeScanEligibilityIn(BaseModel):
    deviceId: str
    userAgent: Optional[str] = None
    attestToken: Optional[str] = None  # DeviceCheck / App Attest (stub)


class FreeScanCreateIn(BaseModel):
    deviceId: str
    company: str
    role: str
    jdText: Optional[str] = None
    date: Optional[str] = None
    interviewers: List[InterviewerIn] = Field(default_factory=list)
    profileUrl: Optional[str] = None
    profileText: Optional[str] = None
    userAgent: Optional[str] = None
    attestToken: Optional[str] = None


class ReportCreateIn(BaseModel):
    deviceId: str
    company: str
    role: str
    jdText: Optional[str] = None
    date: Optional[str] = None
    interviewers: List[InterviewerIn] = Field(default_factory=list)
    profileUrl: Optional[str] = None
    profileText: Optional[str] = None


class EntitlementSyncIn(BaseModel):
    deviceId: str
    # In production this carries the native StoreKit transaction payload.
    receipt: Optional[str] = None
    productId: Optional[str] = None
    devMockUnlock: bool = False  # dev-only; ignored when APP_ENV=production
