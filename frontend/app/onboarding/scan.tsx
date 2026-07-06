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

const STEPS = ["Finding company", "Matching interviewer", "Checking freshness", "Preparing brief"];

export default function ScanScreen() {
  const router = useRouter();
  const { deviceId, draft, setFreeScanReport, markFreeScanUsed } = useApp();
  const [theatreDone, setTheatreDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportReady = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !deviceId) return;
    startedRef.current = true;
    (async () => {
      try {
        const elig = await DeepPrepApi.freeScanEligibility(deviceId);
        if (!elig.eligible) {
          setError(elig.message || "Your free scan has already been used on this device.");
          await ReviewService.record("api_error");
          return;
        }
        const report = await DeepPrepApi.freeScanCreate(deviceId, draft);
        setFreeScanReport(report);
        await markFreeScanUsed(report.id);
        reportReady.current = true;
        await ReviewService.record("free_scan_completed");
        if ((report.freeScanSummary?.matchConfidence ?? 0) >= 85) {
          await ReviewService.record("match_confidence_high");
        }
      } catch (e: any) {
        const msg = e?.detail?.message || e?.message || "We couldn't complete your scan.";
        setError(msg);
        await ReviewService.record("api_error");
      }
    })();
  }, [deviceId, draft, setFreeScanReport, markFreeScanUsed]);

  useEffect(() => {
    if (theatreDone && reportReady.current && !error) {
      HapticsService.success();
      router.replace("/onboarding/result");
    }
  }, [theatreDone, error, router]);

  return (
    <SafeAreaView style={styles.screen} testID="scan-screen">
      <View style={styles.top}>
        <RadarMark size={64} />
        <Text style={styles.title}>Building your free Intel Scan</Text>
        <Text style={styles.sub}>Once complete, we'll scan the quality of our research.</Text>
      </View>

      {error ? (
        <View style={styles.errorBox} testID="scan-error">
          <Text style={styles.errorTitle}>Scan unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Unlock DeepPrep Pro" variant="white" onPress={() => router.replace("/paywall")} testID="scan-error-cta" style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <View style={styles.checklist}>
          <StepChecklist steps={STEPS} stepMs={1500} onDone={() => setTheatreDone(true)} />
          <Text style={styles.hint}>This usually takes 20–40 seconds.</Text>
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
  checklist: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  hint: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.xl },
  errorBox: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  errorTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, marginBottom: spacing.sm },
  errorText: { color: colors.textSecondary, fontSize: font.body, lineHeight: 22 },
});
