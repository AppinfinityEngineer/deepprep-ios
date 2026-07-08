// Global app state: device id, entitlement/credits, current interview draft,
// free scan report, cached reports list, and pending report jobs.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Repository, PendingReportJob } from "../storage/repository";
import { DeepPrepApi } from "../api/deepprep";
import { StoreKitService } from "../storekit/StoreKitService";
import { Entitlement, InterviewDraft, Report, emptyDraft } from "../models/types";
import { SCREENSHOT_MODE } from "../config/screenshotMode";
import { SCREENSHOT_DRAFT, SCREENSHOT_ENTITLEMENT, SCREENSHOT_REPORTS } from "../mock/screenshotData";

interface AppState {
  ready: boolean;
  deviceId: string;
  onboardingDone: boolean;
  freeScanUsed: boolean;
  entitlement: Entitlement | null;
  draft: InterviewDraft;
  freeScanReport: Report | null;
  reports: Report[];
  pendingReportJob: PendingReportJob | null;

  setDraft: (d: Partial<InterviewDraft>) => void;
  resetDraft: () => void;
  setFreeScanReport: (r: Report) => void;
  markFreeScanUsed: (reportId: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  unlockPro: () => Promise<Entitlement>;
  restorePurchases: () => Promise<Entitlement>;
  refreshReports: () => Promise<void>;
  setPendingReportJob: (job: PendingReportJob | null) => Promise<void>;
  devResetForTesting: () => Promise<string>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [freeScanUsed, setFreeScanUsed] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [draft, setDraftState] = useState<InterviewDraft>(emptyDraft());
  const [freeScanReport, setFreeScanReport] = useState<Report | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [pendingReportJobState, setPendingReportJobState] = useState<PendingReportJob | null>(null);

  const refreshEntitlement = useCallback(async (id?: string) => {
    const did = id || deviceId;
    if (!did) return;
    try {
      const ent = await DeepPrepApi.getEntitlement(did);
      setEntitlement(ent);
    } catch {
      // keep last known
    }
  }, [deviceId]);

  const refreshReports = useCallback(async (id?: string) => {
    const did = id || deviceId;
    if (!did) return;
    try {
      const list = await DeepPrepApi.listReports(did);
      setReports(list.filter((r) => r.mode === "full"));
    } catch {
      // ignore
    }
  }, [deviceId]);

  useEffect(() => {
    let stopStoreKitListener = () => {};
    (async () => {
      if (SCREENSHOT_MODE) {
        const id = "screenshot-device";
        setDeviceId(id);
        setOnboardingDone(true);
        setFreeScanUsed(true);
        setEntitlement(SCREENSHOT_ENTITLEMENT);
        setDraftState(SCREENSHOT_DRAFT);
        setReports(SCREENSHOT_REPORTS);
        setReady(true);
        return;
      }
      const id = await Repository.getDeviceId();
      setDeviceId(id);
      setOnboardingDone(await Repository.isOnboardingDone());
      setFreeScanUsed(await Repository.isFreeScanUsed());
      setPendingReportJobState(await Repository.getPendingReportJob());
      stopStoreKitListener = StoreKitService.listenForPurchaseUpdates(id, (ent) => setEntitlement(ent));
      setReady(true);
      void refreshEntitlement(id);
      void refreshReports(id);
    })();
    return () => stopStoreKitListener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDraft = useCallback((d: Partial<InterviewDraft>) => {
    setDraftState((prev) => ({ ...prev, ...d }));
  }, []);

  const resetDraft = useCallback(() => setDraftState(emptyDraft()), []);

  const markFreeScanUsed = useCallback(async (reportId: string) => {
    await Repository.setFreeScanUsed(reportId);
    setFreeScanUsed(true);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await Repository.setOnboardingDone(true);
    setOnboardingDone(true);
  }, []);

  const setPendingReportJob = useCallback(async (job: PendingReportJob | null) => {
    await Repository.setPendingReportJob(job);
    setPendingReportJobState(job);
  }, []);

  const unlockPro = useCallback(async () => {
    if (SCREENSHOT_MODE) {
      setEntitlement(SCREENSHOT_ENTITLEMENT);
      return SCREENSHOT_ENTITLEMENT;
    }
    const result = await StoreKitService.purchase(deviceId);
    if (result.entitlement) {
      setEntitlement(result.entitlement);
      return result.entitlement;
    }
    if (result.pending) {
      const ent = await StoreKitService.current(deviceId);
      setEntitlement(ent);
      return ent;
    }
    throw new Error(result.error || "Purchase could not be completed.");
  }, [deviceId]);

  const restorePurchases = useCallback(async () => {
    if (SCREENSHOT_MODE) {
      setEntitlement(SCREENSHOT_ENTITLEMENT);
      return SCREENSHOT_ENTITLEMENT;
    }
    const result = await StoreKitService.restore(deviceId);
    if (result.entitlement) {
      setEntitlement(result.entitlement);
      return result.entitlement;
    }
    throw new Error(result.error || "No active subscription found.");
  }, [deviceId]);

  const devResetForTesting = useCallback(async () => {
    const oldId = deviceId;
    if (oldId) {
      try {
        await DeepPrepApi.devResetFreeScan(oldId);
      } catch {
        // Continue local reset.
      }
    }

    try {
      await DeepPrepApi.devResetAllFreeScans();
    } catch {
      // Development-only endpoint may not be deployed. Fresh id still unblocks local state.
    }

    const newId = await Repository.createFreshDevDeviceId();
    setDeviceId(newId);
    setOnboardingDone(false);
    setFreeScanUsed(false);
    setEntitlement(null);
    setFreeScanReport(null);
    setReports([]);
    setPendingReportJobState(null);
    setDraftState(emptyDraft());
    return newId;
  }, [deviceId]);

  return (
    <Ctx.Provider
      value={{
        ready,
        deviceId,
        onboardingDone,
        freeScanUsed,
        entitlement,
        draft,
        freeScanReport,
        reports,
        pendingReportJob: pendingReportJobState,
        setDraft,
        resetDraft,
        setFreeScanReport,
        markFreeScanUsed,
        completeOnboarding,
        refreshEntitlement,
        unlockPro,
        restorePurchases,
        refreshReports,
        setPendingReportJob,
        devResetForTesting,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
