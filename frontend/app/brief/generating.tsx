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
  "Resolving company",
  "Finding public professional signals",
  "Matching interviewers",
  "Checking freshness",
  "Building full brief",
];

const LONG_WAIT_SECONDS = 75;
const HARD_WAIT_SECONDS = 135;

function progressForElapsed(seconds: number) {
  if (seconds < 10) return 0.18;
  if (seconds < 25) return 0.38;
  if (seconds < 45) return 0.58;
  if (seconds < 75) return 0.76;
  if (seconds < 120) return 0.88;
  return 0.94;
}

function statusForElapsed(seconds: number) {
  if (seconds < 12) return "Starting secure report generation…";
  if (seconds < 30) return "Searching public company and interviewer signals…";
  if (seconds < 55) return "Synthesising the full interview brief…";
  if (seconds < LONG_WAIT_SECONDS) return "Finalising questions, talking points and day-of notes…";
  return "Still working. This can take up to two minutes on live web research.";
}

export default function Generating() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { deviceId, draft, completeOnboarding, refreshEntitlement, refreshReports } = useApp();
  const [theatreDone, setTheatreDone] = useState(false);
  const [error, setError] = useState<{ msg: string; reason?: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isLongWait, setIsLongWait] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reportId = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= LONG_WAIT_SECONDS) setIsLongWait(true);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt]);

  const generate = useCallback(async () => {
    if (!deviceId) return;
    setError(null);
    setElapsed(0);
    setIsLongWait(false);
    reportId.current = null;

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("report_generation_timeout")), HARD_WAIT_SECONDS * 1000);
      });
      const res = await Promise.race([DeepPrepApi.createReport(deviceId, draft), timeout]);
      reportId.current = res.report.id;
      await refreshEntitlement();
      await refreshReports();
      if (params.from === "onboarding") await completeOnboarding();
      await ReviewService.record("report_generated");
    } catch (e: any) {
      const reason = e?.detail?.reason || (String(e?.message || e).includes("report_generation_timeout") ? "timeout" : undefined);
      let msg = "We could not generate your report. Your subscription is not lost — try again and DeepPrep will use your active credits.";
      if (reason === "timeout") msg = "The live report took too long. This usually means public search or AI synthesis is slow. Try again now — your purchase is active and your report can still be generated.";
      else if (reason === "insufficient_credits" || reason === "no_active_subscription") msg = "Your purchase is active only after Apple confirms it. Tap Restore Purchases or try again in a moment.";
      else if (reason === "daily_credit_cap") msg = "Daily credit limit reached. Please try again tomorrow.";
      else if (reason === "weekly_credit_cap") msg = "Weekly credit limit reached.";
      else if (reason === "llm_not_configured") msg = "AI synthesis is temporarily unavailable. The backend keys need checking before more reports can be generated.";
      setError({ msg, reason });
      await ReviewService.record("report_failed");
    }
  }, [completeOnboarding, deviceId, draft, params.from, refreshEntitlement, refreshReports]);

  useEffect(() => {
    if (started.current || !deviceId) return;
    started.current = true;
    void generate();
  }, [deviceId, generate]);

  useEffect(() => {
    if (theatreDone && reportId.current && !error) {
      HapticsService.success();
      router.replace(`/report/${reportId.current}`);
    }
  }, [theatreDone, error, router]);

  const onRetry = () => {
    started.current = true;
    setTheatreDone(false);
    setAttempt((x) => x + 1);
    void generate();
  };

  const progress = Math.round(progressForElapsed(elapsed) * 100);

  return (
    <SafeAreaView style={styles.screen} testID="generating-screen">
      <View style={styles.top}>
        <RadarMark size={64} />
        <Text style={styles.title}>Building your full brief</Text>
        <Text style={styles.sub}>{draft.company} · {draft.role}</Text>
      </View>

      {error ? (
        <View style={styles.errorBox} testID="generating-error">
          <Text style={styles.errorTitle}>Report not ready yet</Text>
          <Text style={styles.errorText}>{error.msg}</Text>
          <Button label="Try Again" variant="white" onPress={onRetry} style={{ marginTop: spacing.lg }} testID="generating-error-retry" />
          <Button label="Back to Home" variant="dark" onPress={() => router.replace("/(tabs)")} style={{ marginTop: spacing.md }} testID="generating-error-home" />
        </View>
      ) : (
        <View style={styles.card}>
          <StepChecklist steps={STEPS} stepMs={1500} onDone={() => setTheatreDone(true)} />
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{statusForElapsed(elapsed)}</Text>
          <Text style={styles.elapsedText}>{elapsed}s elapsed · live search + AI synthesis</Text>
          {isLongWait ? <Text style={styles.longWaitText}>Still working — keep this screen open. If it times out, you can retry without repurchasing.</Text> : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "center" },
  top: { alignItems: "center", marginBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.lg },
  sub: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  progressTrack: { height: 8, backgroundColor: colors.surfaceRaised, borderRadius: 999, overflow: "hidden", marginTop: spacing.xl },
  progressFill: { height: 8, backgroundColor: colors.accent, borderRadius: 999 },
  progressText: { color: colors.textPrimary, fontSize: font.small, fontWeight: font.medium, lineHeight: 20, marginTop: spacing.md, textAlign: "center" },
  elapsedText: { color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.sm, textAlign: "center" },
  longWaitText: { color: colors.textSecondary, fontSize: font.tiny, lineHeight: 18, marginTop: spacing.md, textAlign: "center" },
  errorBox: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  errorTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, marginBottom: spacing.sm },
  errorText: { color: colors.textSecondary, fontSize: font.body, lineHeight: 22 },
});
