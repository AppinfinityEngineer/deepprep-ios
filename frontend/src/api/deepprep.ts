// Typed DeepPrep API bindings.
import { http } from "./client";
import { Entitlement, InterviewDraft, Report } from "../models/types";

function interviewersPayload(d: InterviewDraft) {
  return d.interviewers
    .filter((i) => i.name.trim())
    .map((i) => ({
      name: i.name,
      title: i.title || undefined,
      linkedinUrl: i.linkedinUrl || undefined,
      profileText: i.profileText || undefined,
    }));
}

export const DeepPrepApi = {
  health: () => http.get<{ status: string }>("/health"),

  freeScanEligibility: (deviceId: string, userAgent?: string) =>
    http.post<{ eligible: boolean; reason: string; message?: string; freeScanReportId?: string }>(
      "/free-scan/eligibility",
      { deviceId, userAgent }
    ),

  freeScanCreate: (deviceId: string, d: InterviewDraft) =>
    http.post<Report>("/free-scan/create", {
      deviceId,
      company: d.company,
      role: d.role,
      jdText: d.jdText || undefined,
      date: d.date || undefined,
      interviewers: interviewersPayload(d),
    }),

  getFreeScan: (id: string) => http.get<Report>(`/free-scan/${id}`),

  createReport: (deviceId: string, d: InterviewDraft) =>
    http.post<{ report: Report; creditsRemaining: number }>("/reports", {
      deviceId,
      company: d.company,
      role: d.role,
      jdText: d.jdText || undefined,
      date: d.date || undefined,
      interviewers: interviewersPayload(d),
    }),

  listReports: (deviceId: string) => http.get<Report[]>(`/reports?deviceId=${deviceId}`),
  getReport: (id: string) => http.get<Report>(`/reports/${id}`),

  entitlementSync: (deviceId: string, opts: { receipt?: string; productId?: string; devMockUnlock?: boolean }) =>
    http.post<Entitlement>("/entitlement/sync", { deviceId, ...opts }),

  getEntitlement: (deviceId: string) => http.get<Entitlement>(`/entitlement?deviceId=${deviceId}`),

  getUsage: (deviceId: string) =>
    http.get<{ creditsRemaining: number; active: boolean; introUsed: boolean }>(`/usage?deviceId=${deviceId}`),

  privacyDelete: (deviceId: string) => http.post<{ deleted: boolean }>("/privacy/delete", { deviceId }),
};
