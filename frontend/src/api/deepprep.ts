// Typed DeepPrep API bindings.
import { http } from "./client";
import { Entitlement, InterviewDraft, Report } from "../models/types";

function clean(v?: string) {
  const t = v?.trim();
  return t ? t : undefined;
}

function withDevice(path: string, deviceId: string) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}deviceId=${encodeURIComponent(deviceId)}`;
}

function interviewersPayload(d: InterviewDraft) {
  const interviewers = d.interviewers
    .filter((i) => i.name.trim())
    .map((i) => ({
      name: i.name.trim(),
      title: clean(i.title),
      linkedinUrl: clean(i.linkedinUrl),
      profileText: clean(i.profileText),
    }));

  if (interviewers.length > 0) {
    if (clean(d.profileUrl) && !interviewers[0].linkedinUrl) {
      interviewers[0].linkedinUrl = clean(d.profileUrl);
    }
    if (clean(d.profileText) && !interviewers[0].profileText) {
      interviewers[0].profileText = clean(d.profileText);
    }
  }
  return interviewers;
}

function interviewPayload(deviceId: string, d: InterviewDraft) {
  return {
    deviceId,
    company: d.company.trim(),
    role: d.role.trim(),
    jdText: clean(d.jdText),
    date: clean(d.date),
    profileUrl: clean(d.profileUrl),
    profileText: clean(d.profileText),
    interviewers: interviewersPayload(d),
  };
}

export type ReportJobStart = { interviewId: string; status: "generating"; creditsRemaining: number };
export type ReportJobStatus = {
  interviewId: string;
  status: "draft" | "free_scan" | "generating" | "ready" | "failed";
  reportId?: string | null;
  report?: Report | null;
  errorReason?: string | null;
  errorMessage?: string | null;
  updatedAt?: string | null;
};

export const DeepPrepApi = {
  health: () => http.get<{ status: string }>("/health"),

  freeScanEligibility: (deviceId: string, userAgent?: string) =>
    http.post<{ eligible: boolean; reason: string; message?: string; freeScanReportId?: string }>(
      "/free-scan/eligibility",
      { deviceId, userAgent }
    ),

  freeScanCreate: (deviceId: string, d: InterviewDraft) =>
    http.post<Report>("/free-scan/create", interviewPayload(deviceId, d)),

  getFreeScan: (id: string) => http.get<Report>(`/free-scan/${id}`),

  createReport: (deviceId: string, d: InterviewDraft) =>
    http.post<{ report: Report; creditsRemaining: number }>("/reports", interviewPayload(deviceId, d)),

  startReport: (deviceId: string, d: InterviewDraft) =>
    http.post<ReportJobStart>("/reports/start", interviewPayload(deviceId, d)),

  getReportStatus: (deviceId: string, interviewId: string) =>
    http.get<ReportJobStatus>(withDevice(`/reports/status/${interviewId}`, deviceId)),

  listReports: (deviceId: string) => http.get<Report[]>(`/reports?deviceId=${encodeURIComponent(deviceId)}`),
  getReport: (id: string, deviceId: string) => http.get<Report>(withDevice(`/reports/${id}`, deviceId)),

  entitlementSync: (deviceId: string, opts: { receipt?: string; productId?: string; devMockUnlock?: boolean }) =>
    http.post<Entitlement>("/entitlement/sync", { deviceId, ...opts }),

  getEntitlement: (deviceId: string) => http.get<Entitlement>(`/entitlement?deviceId=${encodeURIComponent(deviceId)}`),

  getUsage: (deviceId: string) =>
    http.get<{ creditsRemaining: number; active: boolean; introUsed: boolean }>(`/usage?deviceId=${encodeURIComponent(deviceId)}`),

  privacyDelete: (deviceId: string) => http.post<{ deleted: boolean }>("/privacy/delete", { deviceId }),

  devResetFreeScan: (deviceId: string) =>
    http.post<{ ok: boolean; deviceId: string }>("/dev/reset-free-scan", { deviceId }),

  devResetAllFreeScans: () =>
    http.post<{ ok: boolean; mode: string }>("/dev/reset-all-free-scans", {}),
};
