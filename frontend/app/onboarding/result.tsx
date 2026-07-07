import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { colors, spacing, font, radius } from "@/src/theme";
import { ScreenContainer, Button, Card, Badge, SectionTitle, Bullet } from "@/src/components/ui";
import { ConfidenceMeter } from "@/src/components/ConfidenceMeter";
import { useApp } from "@/src/state/AppContext";

function toneForStatus(status: string) {
  const s = status.toLowerCase();
  if (s.includes("user-supplied") || s.includes("profile")) return "success";
  if (s.includes("conflict") || s.includes("stale")) return "danger";
  if (s.includes("latest")) return "warning";
  return "neutral";
}

export default function ResultScreen() {
  const router = useRouter();
  const { freeScanReport } = useApp();
  const s = freeScanReport?.freeScanSummary;

  if (!freeScanReport || !s) {
    return (
      <ScreenContainer testID="result-empty">
        <Text style={styles.title}>Your Free Intel Scan</Text>
        <Text style={styles.sub}>We could not find your scan. Please try again.</Text>
        <Button label="Back to start" variant="dark" onPress={() => router.replace("/onboarding")} style={{ marginTop: spacing.xl }} />
      </ScreenContainer>
    );
  }

  const freshTone = s.roleFreshness === "High" ? "success" : s.roleFreshness === "Low" ? "warning" : "warning";

  return (
    <ScreenContainer scroll testID="result-screen">
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Your Free Intel Scan</Text>
          <Text style={styles.company}>
            {freeScanReport.company} · {freeScanReport.role}
          </Text>
        </View>
        <Badge label="SCAN COMPLETE" tone="success" testID="scan-complete-badge" />
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <ConfidenceMeter label="Match Confidence" percent={s.matchConfidence} tone="success" />
        <View style={styles.freshRow}>
          <Text style={styles.freshLabel}>Role Freshness</Text>
          <Badge label={s.roleFreshness} tone={freshTone as any} />
        </View>
        {s.currentRoleStatus ? (
          <View style={styles.freshRow}>
            <Text style={styles.freshLabel}>Current Role Status</Text>
            <Badge label={s.currentRoleStatus} tone={toneForStatus(s.currentRoleStatus) as any} testID="scan-current-role-status" />
          </View>
        ) : null}
        {s.profileEvidenceUsed ? (
          <View style={styles.evidenceBox} testID="scan-profile-evidence-used">
            <Badge label="PROFILE EVIDENCE USED" tone="accent" />
            <Text style={styles.evidenceText}>Current-role freshness was upgraded from the profile evidence you supplied.</Text>
          </View>
        ) : null}
        {s.freshnessNote ? <Text style={styles.noteText}>{s.freshnessNote}</Text> : null}
      </Card>

      <SectionTitle style={{ marginTop: spacing.xl }}>What DeepPrep Found</SectionTitle>
      <Card>
        {s.keyInsights.map((k, i) => (
          <Bullet key={i} text={k} tone="accent" />
        ))}
        {s.recommendedAction ? <Bullet text={s.recommendedAction} tone="accent" /> : null}
      </Card>

      <SectionTitle style={{ marginTop: spacing.xl }}>Question You Should Prepare For</SectionTitle>
      <Card>
        <Text style={styles.valueLabel}>Likely interview question</Text>
        <Text style={styles.body}>{s.likelyQuestion}</Text>
      </Card>

      <SectionTitle style={{ marginTop: spacing.xl }}>Strong Talking Point</SectionTitle>
      <Card>
        <Text style={styles.valueLabel}>Use this to sound prepared</Text>
        <Text style={styles.body}>{s.talkingPoint}</Text>
      </Card>

      <SectionTitle style={{ marginTop: spacing.xl }}>Full Report Unlocks</SectionTitle>
      <Card>
        <Bullet text="Complete company brief with risks, signals and opportunities" tone="accent" />
        <Bullet text="Full interviewer dossier with likely priorities and interview style" tone="accent" />
        <Bullet text="5+ tailored questions with STAR answer angles" tone="accent" />
        <Bullet text="Day-of brief you can read minutes before the interview" tone="accent" />
      </Card>

      {freeScanReport.sourceNotes?.length ? (
        <>
          <SectionTitle style={{ marginTop: spacing.xl }}>Source Notes</SectionTitle>
          <Card>
            {freeScanReport.sourceNotes.slice(0, 4).map((note, i) => (
              <View key={`${note.label}-${i}`} style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>{note.label}</Text>
                <Text style={styles.sourceDetail}>{note.detail}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {freeScanReport.cost ? (
        <Text style={styles.costText}>
          Search proof: {freeScanReport.cost.searchQueryCount} live queries · {freeScanReport.cost.searchResultCount} public results · est. £
          {freeScanReport.cost.estimatedTotalCostGbp.toFixed(3)}
        </Text>
      ) : null}

      <View style={styles.lockNote}>
        <Text style={styles.lockText}>
          Your scan found live signals and one useful prep angle. Unlock the full report to turn this into
          a complete interview plan with questions, dossiers, STAR angles and a day-of brief.
        </Text>
      </View>

      <Button
        label="See Full Report"
        variant="white"
        icon="lock"
        onPress={() => router.push("/onboarding/review")}
        testID="see-full-report"
        style={{ marginTop: spacing.xl }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, letterSpacing: -0.3 },
  company: { color: colors.textSecondary, fontSize: font.small, marginTop: 4 },
  sub: { color: colors.textSecondary, fontSize: font.body, marginTop: spacing.sm },
  freshRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, gap: spacing.md },
  freshLabel: { color: colors.textSecondary, fontSize: font.small, flex: 1 },
  evidenceBox: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  evidenceText: { color: colors.textSecondary, fontSize: font.small, lineHeight: 20 },
  noteText: { color: colors.textMuted, fontSize: font.tiny, lineHeight: 18, marginTop: spacing.md },
  valueLabel: { color: colors.accent, fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 0.5, marginBottom: spacing.sm },
  body: { color: colors.textPrimary, fontSize: font.body, lineHeight: 23 },
  sourceRow: { marginBottom: spacing.md },
  sourceLabel: { color: colors.textPrimary, fontSize: font.tiny, fontWeight: font.bold, marginBottom: 4 },
  sourceDetail: { color: colors.textMuted, fontSize: font.tiny, lineHeight: 18 },
  costText: { color: colors.textMuted, fontSize: font.tiny, lineHeight: 18, textAlign: "center", marginTop: spacing.lg },
  lockNote: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  lockText: { color: colors.textSecondary, fontSize: font.small, lineHeight: 21 },
});
