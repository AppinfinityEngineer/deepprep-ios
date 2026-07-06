import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { colors, spacing, font, radius } from "@/src/theme";
import { Card, Badge, Bullet, SectionTitle } from "@/src/components/ui";
import { Report } from "@/src/models/types";
import { DeepPrepApi } from "@/src/api/deepprep";
import { ReviewService } from "@/src/review/ReviewService";
import { HapticsService } from "@/src/haptics/HapticsService";

const TABS = ["Overview", "Dossiers", "Questions", "Day-of"] as const;
type Tab = (typeof TABS)[number];

function toneFor(v: string): "success" | "warning" | "danger" | "neutral" {
  const s = v.toLowerCase();
  if (s.includes("high")) return "success";
  if (s.includes("medium")) return "warning";
  if (s.includes("low") || s.includes("stale") || s.includes("conflict")) return "danger";
  return "neutral";
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await DeepPrepApi.getReport(String(id));
        setReport(r);
      } catch {
        await ReviewService.record("api_error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const copyDayOf = async () => {
    if (!report) return;
    await Clipboard.setStringAsync(report.dayOfBrief);
    await HapticsService.success();
    await ReviewService.record("section_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onTab = (t: Tab) => {
    HapticsService.select();
    setTab(t);
    if (t === "Day-of") ReviewService.record("opened_day_of_brief");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="report-screen">
      {/* Sticky header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(tabs)")} hitSlop={12} testID="report-back">
          <Feather name="chevron-left" size={26} color={colors.textSecondary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.hCompany} numberOfLines={1}>{report?.company ?? "Report"}</Text>
          <Text style={styles.hRole} numberOfLines={1}>{report?.role ?? ""}</Text>
        </View>
      </View>

      {/* Segmented tabs (sticky) */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => onTab(t)} style={[styles.tab, tab === t && styles.tabActive]} testID={`tab-${t}`}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}><Text style={styles.dim}>Loading report…</Text></View>
      ) : !report ? (
        <View style={styles.loading}><Text style={styles.dim}>Report not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {tab === "Overview" && <Overview report={report} />}
          {tab === "Dossiers" && <Dossiers report={report} onOpen={(i) => router.push(`/dossier/${report.id}?index=${i}`)} />}
          {tab === "Questions" && <Questions report={report} />}
          {tab === "Day-of" && <DayOf report={report} onCopy={copyDayOf} copied={copied} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Overview({ report }: { report: Report }) {
  return (
    <View>
      <SectionTitle>Executive Summary</SectionTitle>
      <Card><Text style={styles.body}>{report.executiveSummary}</Text></Card>

      <SectionTitle style={styles.mt}>Company Signals</SectionTitle>
      <Card>
        {report.companyBrief.summary ? <Text style={[styles.body, { marginBottom: spacing.md }]}>{report.companyBrief.summary}</Text> : null}
        {report.companyBrief.signals.map((s, i) => <Bullet key={i} text={s} tone="accent" />)}
      </Card>

      {report.companyBrief.opportunities.length > 0 && (
        <>
          <SectionTitle style={styles.mt}>Opportunities</SectionTitle>
          <Card>{report.companyBrief.opportunities.map((s, i) => <Bullet key={i} text={s} />)}</Card>
        </>
      )}
      {report.companyBrief.risks.length > 0 && (
        <>
          <SectionTitle style={styles.mt}>Risks to Watch</SectionTitle>
          <Card>{report.companyBrief.risks.map((s, i) => <Bullet key={i} text={s} />)}</Card>
        </>
      )}

      {report.freshnessNotes.length > 0 && (
        <>
          <SectionTitle style={styles.mt}>Freshness Notes</SectionTitle>
          <Card>{report.freshnessNotes.map((s, i) => <Bullet key={i} text={s} />)}</Card>
        </>
      )}
    </View>
  );
}

function Dossiers({ report, onOpen }: { report: Report; onOpen: (i: number) => void }) {
  if (report.dossiers.length === 0) return <Text style={styles.dim}>No interviewer dossiers in this brief.</Text>;
  return (
    <View>
      {report.dossiers.map((d, i) => (
        <Card key={i} style={styles.dossierCard} onPress={() => onOpen(i)} testID={`dossier-card-${i}`}>
          <View style={styles.dossierHead}>
            <View style={styles.avatar}><Feather name="user" size={20} color={colors.textSecondary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dName}>{d.name}</Text>
              {d.title ? <Text style={styles.dTitle}>{d.title}</Text> : null}
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </View>
          <View style={styles.badgeRow}>
            <Badge label={`MATCH: ${d.matchConfidence.toUpperCase()}`} tone={toneFor(d.matchConfidence)} />
            <Badge label={`FRESH: ${d.roleFreshness.toUpperCase()}`} tone={toneFor(d.roleFreshness)} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function Questions({ report }: { report: Report }) {
  return (
    <View>
      <SectionTitle>Likely Questions</SectionTitle>
      {report.likelyQuestions.map((q, i) => (
        <Card key={i} style={{ marginBottom: spacing.md }} testID={`question-${i}`}>
          <View style={styles.qHead}>
            <Text style={styles.qText}>{q.question}</Text>
            <Badge label={q.confidence.toUpperCase()} tone={toneFor(q.confidence)} />
          </View>
          {q.why ? <Text style={styles.qWhy}>Why: {q.why}</Text> : null}
          {q.starAngle ? <Text style={styles.qStar}>STAR angle: {q.starAngle}</Text> : null}
        </Card>
      ))}

      <SectionTitle style={styles.mt}>Smart Talking Points</SectionTitle>
      {report.talkingPoints.map((t, i) => (
        <Card key={i} style={{ marginBottom: spacing.md }} testID={`talking-point-${i}`}>
          <Text style={styles.body}>{t.point}</Text>
          {t.advice ? <Text style={styles.qWhy}>{t.advice}</Text> : null}
        </Card>
      ))}
    </View>
  );
}

function DayOf({ report, onCopy, copied }: { report: Report; onCopy: () => void; copied: boolean }) {
  return (
    <View>
      <View style={styles.dayOfHead}>
        <SectionTitle style={{ marginBottom: 0 }}>Day-of Brief</SectionTitle>
        <Pressable onPress={onCopy} style={styles.copyBtn} testID="copy-day-of">
          <Feather name={copied ? "check" : "copy"} size={15} color={copied ? colors.success : colors.textPrimary} />
          <Text style={[styles.copyText, copied && { color: colors.success }]}>{copied ? "Copied" : "Copy"}</Text>
        </Pressable>
      </View>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.dayOfText}>{report.dayOfBrief}</Text>
      </Card>
      {report.confidenceNotes.length > 0 && (
        <>
          <SectionTitle style={styles.mt}>Confidence Notes</SectionTitle>
          <Card>{report.confidenceNotes.map((s, i) => <Bullet key={i} text={s} />)}</Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  hCompany: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold },
  hRole: { color: colors.textSecondary, fontSize: font.small },
  tabs: { flexDirection: "row", marginHorizontal: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surfaceRaised },
  tabText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: font.semibold },
  tabTextActive: { color: colors.textPrimary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  dim: { color: colors.textMuted, fontSize: font.body },
  body: { color: colors.textPrimary, fontSize: font.body, lineHeight: 24 },
  mt: { marginTop: spacing.xl },
  dossierCard: { marginBottom: spacing.md },
  dossierHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  dName: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.bold },
  dTitle: { color: colors.textSecondary, fontSize: font.small, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  qHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  qText: { flex: 1, color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold, lineHeight: 22 },
  qWhy: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm, lineHeight: 20 },
  qStar: { color: colors.textMuted, fontSize: font.small, marginTop: spacing.xs, lineHeight: 20 },
  dayOfHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  copyText: { color: colors.textPrimary, fontSize: font.tiny, fontWeight: font.semibold },
  dayOfText: { color: colors.textPrimary, fontSize: font.body, lineHeight: 26 },
});
