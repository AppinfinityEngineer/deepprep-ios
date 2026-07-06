// Global app state: device id, entitlement/credits, current interview draft,
// free scan report, and cached reports list.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Repository } from "../storage/repository";
import { DeepPrepApi } from "../api/deepprep";
import { StoreKitService } from "../storekit/StoreKitService";
import { Entitlement, InterviewDraft, Report, emptyDraft } from "../models/types";

interface AppState {
  ready: boolean;
  deviceId: string;
  onboardingDone: boolean;
  freeScanUsed: boolean;
  entitlement: Entitlement | null;
  draft: InterviewDraft;
  freeScanReport: Report | null;
  reports: Report[];

  setDraft: (d: Partial<InterviewDraft>) => void;
  resetDraft: () => void;
  setFreeScanReport: (r: Report) => void;
  markFreeScanUsed: (reportId: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  unlockPro: () => Promise<Entitlement>;
  restorePurchases: () => Promise<Entitlement>;
  refreshReports: () => Promise<void>;
  devResetForTesting: () => Promise<void>;
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
    (async () => {
      const id = await Repository.getDeviceId();
      setDeviceId(id);
      setOnboardingDone(await Repository.isOnboardingDone());
      setFreeScanUsed(await Repository.isFreeScanUsed());
      await refreshEntitlement(id);
      await refreshReports(id);
      setReady(true);
    })();
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

  const unlockPro = useCallback(async () => {
    const ent = await StoreKitService.purchase(deviceId);
    setEntitlement(ent);
    return ent;
  }, [deviceId]);

  const restorePurchases = useCallback(async () => {
    const ent = await StoreKitService.restore(deviceId);
    setEntitlement(ent);
    return ent;
  }, [deviceId]);

  const devResetForTesting = useCallback(async () => {
    const oldId = deviceId;
    if (oldId) {
      try {
        await DeepPrepApi.devResetFreeScan(oldId);
      } catch {
        // Keep local reset useful even if the backend dev endpoint is not yet deployed.
      }
    }

    await Repository.resetForDev();
    const newId = await Repository.getDeviceId();
    setDeviceId(newId);
    setOnboardingDone(false);
    setFreeScanUsed(false);
    setEntitlement(null);
    setFreeScanReport(null);
    setReports([]);
    setDraftState(emptyDraft());
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
        setDraft,
        resetDraft,
        setFreeScanReport,
        markFreeScanUsed,
        completeOnboarding,
        refreshEntitlement,
        unlockPro,
        restorePurchases,
        refreshReports,
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
