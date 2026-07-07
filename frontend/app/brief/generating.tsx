import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font } from "@/src/theme";
import { RadarMark } from "@/src/components/RadarMark";
import { StepChecklist } from "@/src/components/StepChecklist";
import { Button } from "@/src/components/ui";
import { useApp } from "@/src/state/AppContext";
import { DeepPrepApi } from "@/src/api/deepprep";
import { ReviewService } from "@/src/review/ReviewService";
import { HapticsService } from "@/src/haptics/HapticsService";

const STEPS = [
  "Creating secure report job",
  "Checking public professional signals",
  "Building the AI interview brief",
  "Preparing questions and talking points",
  "Saving your full report",
];

const POLL_MS = 2500;
const SOFT_WAIT_SECONDS = 45;
const LOCAL_TIMEOUT_SECONDS = 120;

function progressForElapsed(seconds: number) {
  if (seconds < 8) return 0.18;
  if (seconds < 20) return 0.38;
  if (seconds < 40) return 0.62;
  if (seconds < 70) return 0.78;
  if (seconds < LOCAL_TIMEOUT_SECONDS) return 0.9;
  return 0.96;
}

function statusForElapsed(seconds: number) {
  if (seconds < 8) return "Starting your report job…";
  if (seconds < 25) return "The backend is working now. You can safely leave and reopen the app.";
  if (seconds < SOFT_WAIT_SECONDS) return "Most reports finish around this point. Checking for the saved report…";
  if (seconds < LOCAL_TIMEOUT_SECONDS) return "Still processing. If you leave, DeepPrep will resume this report when you reopen.";
  return "This is taking too long. You can retry without repurchasing.";
}

export default function Generating() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; resume?: string; interviewId?: string }>();
  const {
    deviceId,
    draft,
    pendingReportJob,
    setPendingReportJob,
    completeOnboarding,
    refreshEntitlement,
    refreshReports,
  } = useApp();
  const [theatreDone, setTheatreDone] = useState(false);
  const [error, setError] = useState<{ msg: string; reason?: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [activeInterviewId, setActiveInterviewId] = useState<string | null>(params.interviewId || pendingReportJob?.interviewId || null);
  const reportId = useRef<string | null>(null);
  const started = useRef(false);
  const polling = useRef(false);

  const displayCompany = draft.company || pendingReportJob?.company || "Your interview";
  const displayRole = draft.role || pendingReportJob?.role || "Full brief";

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [attempt]);

  const finishWithReport = useCallback(async (id: string) => {
    reportId.current = id;
    await setPendingReportJob(null);
    await refreshEntitlement();
    await refreshReports();
    if (params.from === "onboarding" || pendingReportJob?.fromOnboarding) await completeOnboarding();
    await ReviewService.record("report_generated");
    HapticsService.success();
    router.replace(`/report/${id}`);
  }, [completeOnboarding, params.from, pendingReportJob?.fromOnboarding, refreshEntitlement, refreshReports, router, setPendingReportJob]);

  const pollStatus = useCallback(async (interviewId: string) => {
    if (!deviceId || polling.current) return;
    polling.current = true;
    try {
      while (true) {
        const status = await DeepPrepApi.getReportStatus(deviceId, interviewId);
        if (status.status === "ready" && (status.report?.id || status.reportId)) {
          await finishWithReport(status.report?.id || String(status.reportId));
          return;
        }
        if (status.status === "failed") {
          await setPendingReportJob(null);
          setError({
            reason: status.errorReason || "generation_failed",
            msg: status.errorMessage || "The backend could not finish this report. Try again — your failed credit was refunded.",
          });
          await ReviewService.record("report_failed");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    } catch (e: any) {
      setError({
        reason: "poll_failed",
        msg: "DeepPrep could not check the saved report status. Check your connection and try again — you do not need to repurchase.",
      });
    } finally {
      polling.current = false;
    }
  }, [deviceId, finishWithReport, setPendingReportJob]);

  const startOrResume = useCallback(async () => {
    if (!deviceId) return;
    setError(null);
    setElapsed(0);
    reportId.current = null;

    const existing = activeInterviewId || params.interviewId || pendingReportJob?.interviewId;
    if (existing) {
      setActiveInterviewId(existing);
      void pollStatus(existing);
      return;
    }

    if (!draft.company || !draft.role) {
      setError({ reason: "missing_draft", msg: "The brief details were lost. Start a new brief and DeepPrep will generate it from your saved subscription." });
      return;
    }

    try {
      const startedJob = await DeepPrepApi.startReport(deviceId, draft);
      const job = {
        interviewId: startedJob.interviewId,
        company: draft.company,
        role: draft.role,
        fromOnboarding: params.from === "onboarding",
        createdAt: Date.now(),
      };
      await setPendingReportJob(job);
      setActiveInterviewId(startedJob.interviewId);
      void refreshEntitlement();
      void pollStatus(startedJob.interviewId);
    } catch (e: any) {
      const reason = e?.detail?.reason;
      let msg = "DeepPrep could not start this report. Try again in a moment.";
      if (reason === "insufficient_credits" || reason === "no_active_subscription") msg = "Your purchase is not active on this device yet. Restore Purchases, then try again.";
      else if (reason === "daily_credit_cap") msg = "Daily report limit reached. Try again tomorrow.";
      else if (reason === "weekly_credit_cap") msg = "Weekly report limit reached.";
      setError({ msg, reason });
      await ReviewService.record("report_failed");
    }
  }, [activeInterviewId, deviceId, draft, params.from, params.interviewId, pendingReportJob?.interviewId, pollStatus, refreshEntitlement, setPendingReportJob]);

  useEffect(() => {
    if (started.current || !deviceId) return;
    started.current = true;
    void startOrResume();
  }, [deviceId, startOrResume]);

  const onRetry = () => {
    polling.current = false;
    started.current = true;
    setTheatreDone(false);
    setAttempt((x) => x + 1);
    setActiveInterviewId(null);
    void setPendingReportJob(null);
    void startOrResume();
  };

  const progress = Math.round(progressForElapsed(elapsed) * 100);
  const timedOutLocally = elapsed >= LOCAL_TIMEOUT_SECONDS && !error && !reportId.current;

  return (
    <SafeAreaView style={styles.screen} testID="generating-screen">
      <View style={styles.top}>
        <RadarMark size={64} />
        <Text style={styles.title}>Building your full interview brief</Text>
        <Text style={styles.sub}>{displayCompany} · {displayRole}</Text>
        <Text style={styles.waitNote}>DeepPrep now saves the report in the backend first, then this screen checks for it. Closing the app will not lose the report.</Text>
      </View>

      {error || timedOutLocally ? (
        <View style={styles.errorBox} testID="generating-error">
          <Text style={styles.errorTitle}>{timedOutLocally ? "Still not ready" : "Report not ready"}</Text>
          <Text style={styles.errorText}>{error?.msg || "This report is taking longer than expected. You can retry without repurchasing, or come back later and DeepPrep will check again."}</Text>
          <Button label="Check Again" variant="white" onPress={() => activeInterviewId ? void pollStatus(activeInterviewId) : onRetry()} style={{ marginTop: spacing.lg }} testID="generating-error-retry" />
          <Button label="Start New Brief" variant="dark" onPress={() => router.replace("/brief/new")} style={{ marginTop: spacing.md }} testID="generating-error-new" />
        </View>
      ) : (
        <View style={styles.card}>
          <StepChecklist steps={STEPS} stepMs={1300} onDone={() => setTheatreDone(true)} />
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{statusForElapsed(elapsed)}</Text>
          <Text style={styles.elapsedText}>{elapsed}s elapsed · background report job</Text>
          {activeInterviewId ? <Text style={styles.jobText}>Report job saved. You can leave and return.</Text> : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "center" },
  top: { alignItems: "center", marginBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.lg, textAlign: "center" },
  sub: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  progressTrack: { height: 8, backgroundColor: colors.surfaceRaised, borderRadius: 999, overflow: "hidden", marginTop: spacing.xl },
  progressFill: { height: 8, backgroundColor: colors.accent, borderRadius: 999 },
  progressText: { color: colors.textPrimary, fontSize: font.small, fontWeight: font.medium, lineHeight: 20, marginTop: spacing.md, textAlign: "center" },
  elapsedText: { color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.sm, textAlign: "center" },
  jobText: { color: colors.textSecondary, fontSize: font.tiny, lineHeight: 18, marginTop: spacing.md, textAlign: "center" },
  errorBox: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  errorTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, marginBottom: spacing.sm },
  errorText: { color: colors.textSecondary, fontSize: font.body, lineHeight: 22 },
  waitNote: { color: colors.textMuted, fontSize: font.tiny, lineHeight: 18, textAlign: "center", marginTop: spacing.lg },
});
