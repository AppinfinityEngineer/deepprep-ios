import React, { useEffect, useRef, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
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

export default function Generating() {
  const router = useRouter();
  const { deviceId, draft, refreshEntitlement, refreshReports } = useApp();
  const [theatreDone, setTheatreDone] = useState(false);
  const [error, setError] = useState<{ msg: string; reason?: string } | null>(null);
  const reportId = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !deviceId) return;
    started.current = true;
    (async () => {
      try {
        const res = await DeepPrepApi.createReport(deviceId, draft);
        reportId.current = res.report.id;
        await refreshEntitlement();
        await refreshReports();
        await ReviewService.record("report_generated");
      } catch (e: any) {
        const reason = e?.detail?.reason;
        let msg = "We could not generate your report. Please try again.";
        if (reason === "insufficient_credits" || reason === "no_active_subscription")
          msg = "You're out of Intel Credits. Credits refresh weekly.";
        else if (reason === "daily_credit_cap") msg = "Daily credit limit reached. Please try again tomorrow.";
        else if (reason === "weekly_credit_cap") msg = "Weekly credit limit reached.";
        else if (reason === "llm_not_configured") msg = "AI synthesis is not configured. Add API keys to continue.";
        setError({ msg, reason });
        await ReviewService.record("report_failed");
      }
    })();
  }, [deviceId, draft, refreshEntitlement, refreshReports]);

  useEffect(() => {
    if (theatreDone && reportId.current && !error) {
      HapticsService.success();
      router.replace(`/report/${reportId.current}`);
    }
  }, [theatreDone, error, router]);

  return (
    <SafeAreaView style={styles.screen} testID="generating-screen">
      <View style={styles.top}>
        <RadarMark size={64} />
        <Text style={styles.title}>Building your full brief</Text>
        <Text style={styles.sub}>{draft.company} · {draft.role}</Text>
      </View>

      {error ? (
        <View style={styles.errorBox} testID="generating-error">
          <Text style={styles.errorTitle}>Could not generate report</Text>
          <Text style={styles.errorText}>{error.msg}</Text>
          <Button label="Back to Home" variant="dark" onPress={() => router.replace("/(tabs)")} style={{ marginTop: spacing.lg }} testID="generating-error-home" />
        </View>
      ) : (
        <View style={styles.card}>
          <StepChecklist steps={STEPS} stepMs={1300} onDone={() => setTheatreDone(true)} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "center" },
  top: { alignItems: "center", marginBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.lg },
  sub: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  errorBox: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  errorTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, marginBottom: spacing.sm },
  errorText: { color: colors.textSecondary, fontSize: font.body, lineHeight: 22 },
});
