// Typed DeepPrep API bindings.
import { http } from "./client";
import { Entitlement, InterviewDraft, Report } from "../models/types";

function clean(v?: string) {
  const t = v?.trim();
  return t ? t : undefined;
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

  // V1 UX collects global profile evidence on the onboarding/new-brief step.
  // Treat it as applying to the primary interviewer unless that interviewer
  // already has its own evidence. Backend repeats this hydration server-side.
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

  listReports: (deviceId: string) => http.get<Report[]>(`/reports?deviceId=${deviceId}`),
  getReport: (id: string) => http.get<Report>(`/reports/${id}`),

  entitlementSync: (deviceId: string, opts: { receipt?: string; productId?: string; devMockUnlock?: boolean }) =>
    http.post<Entitlement>("/entitlement/sync", { deviceId, ...opts }),

  getEntitlement: (deviceId: string) => http.get<Entitlement>(`/entitlement?deviceId=${deviceId}`),

  getUsage: (deviceId: string) =>
    http.get<{ creditsRemaining: number; active: boolean; introUsed: boolean }>(`/usage?deviceId=${deviceId}`),

  privacyDelete: (deviceId: string) => http.post<{ deleted: boolean }>("/privacy/delete", { deviceId }),
};
