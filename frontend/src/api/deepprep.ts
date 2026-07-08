// Typed DeepPrep API bindings.
import { http } from "./client";
import { Entitlement, InterviewDraft, Report } from "../models/types";
import { isScreenshotMode } from "../config/screenshotMode";
import { SCREENSHOT_ENTITLEMENT, SCREENSHOT_FREE_SCAN_REPORT, SCREENSHOT_REPORT, SCREENSHOT_REPORTS } from "../mock/screenshotData";

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
  health: () => isScreenshotMode() ? Promise.resolve({ status: "ok" }) : http.get<{ status: string }>("/health"),

  freeScanEligibility: (deviceId: string, userAgent?: string): Promise<{ eligible: boolean; reason: string; message?: string; freeScanReportId?: string }> =>
    isScreenshotMode()
      ? Promise.resolve({ eligible: true, reason: "screenshot_mode" })
      : http.post<{ eligible: boolean; reason: string; message?: string; freeScanReportId?: string }>(
          "/free-scan/eligibility",
          { deviceId, userAgent }
        ),

  freeScanCreate: (deviceId: string, d: InterviewDraft) =>
    isScreenshotMode() ? Promise.resolve(SCREENSHOT_FREE_SCAN_REPORT) : http.post<Report>("/free-scan/create", interviewPayload(deviceId, d)),

  getFreeScan: (id: string) => isScreenshotMode() ? Promise.resolve(SCREENSHOT_FREE_SCAN_REPORT) : http.get<Report>(`/free-scan/${id}`),

  createReport: (deviceId: string, d: InterviewDraft) =>
    isScreenshotMode() ? Promise.resolve({ report: SCREENSHOT_REPORT, creditsRemaining: 6 }) : http.post<{ report: Report; creditsRemaining: number }>("/reports", interviewPayload(deviceId, d)),

  startReport: (deviceId: string, d: InterviewDraft) =>
    isScreenshotMode() ? Promise.resolve({ interviewId: SCREENSHOT_REPORT.interviewId, status: "generating", creditsRemaining: 6 }) : http.post<ReportJobStart>("/reports/start", interviewPayload(deviceId, d)),

  getReportStatus: (deviceId: string, interviewId: string): Promise<ReportJobStatus> =>
    isScreenshotMode() ? Promise.resolve({ interviewId: SCREENSHOT_REPORT.interviewId, status: "ready", reportId: SCREENSHOT_REPORT.id, report: SCREENSHOT_REPORT }) : http.get<ReportJobStatus>(withDevice(`/reports/status/${interviewId}`, deviceId)),

  listReports: (deviceId: string) => isScreenshotMode() ? Promise.resolve(SCREENSHOT_REPORTS) : http.get<Report[]>(`/reports?deviceId=${encodeURIComponent(deviceId)}`),
  getReport: (id: string, deviceId: string) => isScreenshotMode() ? Promise.resolve(SCREENSHOT_REPORT) : http.get<Report>(withDevice(`/reports/${id}`, deviceId)),

  entitlementSync: (deviceId: string, opts: { receipt?: string; productId?: string; devMockUnlock?: boolean }) =>
    isScreenshotMode() ? Promise.resolve(SCREENSHOT_ENTITLEMENT) : http.post<Entitlement>("/entitlement/sync", { deviceId, ...opts }),

  getEntitlement: (deviceId: string) => isScreenshotMode() ? Promise.resolve(SCREENSHOT_ENTITLEMENT) : http.get<Entitlement>(`/entitlement?deviceId=${encodeURIComponent(deviceId)}`),

  getUsage: (deviceId: string) =>
    isScreenshotMode() ? Promise.resolve({ creditsRemaining: 6, active: true, introUsed: true }) : http.get<{ creditsRemaining: number; active: boolean; introUsed: boolean }>(`/usage?deviceId=${encodeURIComponent(deviceId)}`),

  privacyDelete: (deviceId: string) => http.post<{ deleted: boolean }>("/privacy/delete", { deviceId }),

  devResetFreeScan: (deviceId: string) =>
    http.post<{ ok: boolean; deviceId: string }>("/dev/reset-free-scan", { deviceId }),

  devResetAllFreeScans: () =>
    http.post<{ ok: boolean; mode: string }>("/dev/reset-all-free-scans", {}),
};
