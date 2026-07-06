// Shared TypeScript models mirroring the backend schema.

export interface Interviewer {
  id?: string;
  name: string;
  title?: string;
  linkedinUrl?: string;
  profileText?: string;
  notes?: string;
}

export interface FreeScanSummary {
  matchConfidence: number;
  matchLabel: string;
  roleFreshness: string;
  currentRoleStatus?: string;
  recommendedAction?: string;
  profileEvidenceUsed?: boolean;
  freshnessNote?: string;
  keyInsights: string[];
  likelyQuestion: string;
  talkingPoint: string;
}

export interface CompanyBrief {
  summary: string;
  signals: string[];
  risks: string[];
  opportunities: string[];
}

export interface InterviewerDossier {
  interviewerId?: string;
  name: string;
  title?: string;
  matchConfidence: string;
  roleFreshness: string;
  currentRoleStatus: string;
  recommendedAction: string;
  profileSummary: string;
  careerPath: string[];
  likelyPriorities: string[];
  interviewStyle: string;
  questionsTheyMayAsk: string[];
  goodTopics: string[];
  avoid: string[];
  sourceNotes: string[];
  confidenceNotes: string[];
}

export interface LikelyQuestion {
  question: string;
  why: string;
  starAngle: string;
  confidence: "high" | "medium" | "low";
}

export interface TalkingPoint {
  point: string;
  advice: string;
}

export interface SourceNote {
  label: string;
  detail: string;
}

export interface Report {
  id: string;
  interviewId: string;
  generatedAt: string;
  mode: "free_scan" | "full";
  company: string;
  role: string;
  executiveSummary: string;
  freeScanSummary?: FreeScanSummary | null;
  companyBrief: CompanyBrief;
  dossiers: InterviewerDossier[];
  likelyQuestions: LikelyQuestion[];
  talkingPoints: TalkingPoint[];
  dayOfBrief: string;
  confidenceNotes: string[];
  freshnessNotes: string[];
  sourceNotes: SourceNote[];
}

export interface Entitlement {
  active: boolean;
  entitlementId: string;
  productId: string | null;
  creditsRemaining: number;
  introUsed: boolean;
}

// The interview details collected during onboarding / new brief.
export interface InterviewDraft {
  jobSituation?: string;
  roleLevel?: string;
  industry?: string;
  company: string;
  role: string;
  date?: string;
  concerns: string[];
  interviewers: Interviewer[];
  jdText?: string;
  profileUrl?: string;
  profileText?: string;
}

export const emptyDraft = (): InterviewDraft => ({
  company: "",
  role: "",
  concerns: [],
  interviewers: [],
});
