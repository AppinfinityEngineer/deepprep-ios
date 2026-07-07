// Storage repository layer. Screens never touch @/src/utils/storage directly —
// swap the backing store here if needed later.
import { storage } from "@/src/utils/storage";

export type PendingReportJob = {
  interviewId: string;
  company?: string;
  role?: string;
  fromOnboarding?: boolean;
  createdAt: number;
};

const KEYS = {
  deviceId: "dp_anonymous_device_id",
  onboardingDone: "dp_onboarding_done",
  freeScanUsed: "dp_free_scan_used",
  freeScanReportId: "dp_free_scan_report_id",
  pendingReportJob: "dp_pending_report_job",
  reviewState: "dp_review_prompt_state",
} as const;

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function freshDevId(): string {
  return `dev-${Date.now()}-${uuid()}`;
}

async function clearLocalFlowState() {
  await Promise.all([
    storage.secureRemove(KEYS.freeScanUsed),
    storage.secureRemove(KEYS.freeScanReportId),
    storage.removeItem(KEYS.pendingReportJob),
    storage.removeItem(KEYS.onboardingDone),
    storage.removeItem(KEYS.reviewState),
  ]);
}

export const Repository = {
  async getDeviceId(): Promise<string> {
    let id = await storage.secureGet<string>(KEYS.deviceId, "");
    if (!id) {
      id = uuid();
      await storage.secureSet(KEYS.deviceId, id);
    }
    return id;
  },

  async setOnboardingDone(done: boolean) {
    await storage.setItem(KEYS.onboardingDone, done);
  },
  async isOnboardingDone() {
    return (await storage.getItem<boolean>(KEYS.onboardingDone, false)) === true;
  },

  async setFreeScanUsed(reportId: string) {
    await storage.secureSet(KEYS.freeScanUsed, true);
    await storage.secureSet(KEYS.freeScanReportId, reportId);
  },
  async getFreeScanReportId() {
    return await storage.secureGet<string>(KEYS.freeScanReportId, "");
  },
  async isFreeScanUsed() {
    return (await storage.secureGet<boolean>(KEYS.freeScanUsed, false)) === true;
  },

  async setPendingReportJob(job: PendingReportJob | null) {
    if (!job) {
      await storage.removeItem(KEYS.pendingReportJob);
      return;
    }
    await storage.setItem(KEYS.pendingReportJob, JSON.stringify(job));
  },
  async getPendingReportJob(): Promise<PendingReportJob | null> {
    const raw = await storage.getItem<string>(KEYS.pendingReportJob, "");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PendingReportJob;
      return parsed?.interviewId ? parsed : null;
    } catch {
      return null;
    }
  },

  async createFreshDevDeviceId(): Promise<string> {
    const id = freshDevId();
    await clearLocalFlowState();
    await storage.secureSet(KEYS.deviceId, id);
    return id;
  },

  async resetForDev(): Promise<string> {
    return await this.createFreshDevDeviceId();
  },

  async getReviewState(): Promise<{ score: number; lastPromptAt: number; prompted: boolean }> {
    const raw = await storage.getItem<string>(KEYS.reviewState, "");
    if (!raw) return { score: 0, lastPromptAt: 0, prompted: false };
    try {
      return JSON.parse(raw);
    } catch {
      return { score: 0, lastPromptAt: 0, prompted: false };
    }
  },
  async setReviewState(state: { score: number; lastPromptAt: number; prompted: boolean }) {
    await storage.setItem(KEYS.reviewState, JSON.stringify(state));
  },
};
