import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font, radius } from "@/src/theme";
import { Card, Badge, Bullet, SectionTitle } from "@/src/components/ui";
import { InterviewerDossier, Report } from "@/src/models/types";
import { DeepPrepApi } from "@/src/api/deepprep";

function toneFor(v: string): "success" | "warning" | "danger" | "neutral" {
  const s = v.toLowerCase();
  if (s.includes("high")) return "success";
  if (s.includes("medium")) return "warning";
  if (s.includes("low") || s.includes("stale") || s.includes("conflict")) return "danger";
  return "neutral";
}

export default function DossierScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
  const router = useRouter();
  const [dossier, setDossier] = useState<InterviewerDossier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r: Report = await DeepPrepApi.getReport(String(id));
        setDossier(r.dossiers[Number(index) || 0] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, index]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="dossier-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="dossier-back">
          <Feather name="chevron-left" size={26} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.hTitle}>Interviewer Dossier</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><Text style={styles.dim}>Loading…</Text></View>
      ) : !dossier ? (
        <View style={styles.center}><Text style={styles.dim}>Dossier not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={styles.profile}>
            <View style={styles.avatar}><Feather name="user" size={26} color={colors.textSecondary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{dossier.name}</Text>
              {dossier.title ? <Text style={styles.title}>{dossier.title}</Text> : null}
            </View>
          </View>

          <View style={styles.badgeRow}>
            <Badge label={`MATCH: ${dossier.matchConfidence.toUpperCase()}`} tone={toneFor(dossier.matchConfidence)} />
            <Badge label={`FRESH: ${dossier.roleFreshness.toUpperCase()}`} tone={toneFor(dossier.roleFreshness)} />
          </View>

          <Card style={styles.actionCard}>
            <Text style={styles.actionLabel}>Current role status</Text>
            <Text style={styles.actionValue}>{dossier.currentRoleStatus}</Text>
            <Text style={[styles.actionLabel, { marginTop: spacing.md }]}>Recommended action</Text>
            <Text style={styles.actionValue}>{dossier.recommendedAction}</Text>
          </Card>

          {dossier.profileSummary ? (
            <>
              <SectionTitle style={styles.mt}>Profile Summary</SectionTitle>
              <Card><Text style={styles.body}>{dossier.profileSummary}</Text></Card>
            </>
          ) : null}

          {dossier.careerPath.length > 0 && (
            <>
              <SectionTitle style={styles.mt}>Career Path</SectionTitle>
              <View style={styles.timeline}>
                {dossier.careerPath.map((c, i) => (
                  <View key={i} style={styles.tlRow}>
                    <View style={styles.tlDot} />
                    <Text style={styles.tlText}>{c}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {dossier.likelyPriorities.length > 0 && (
            <>
              <SectionTitle style={styles.mt}>Likely Priorities</SectionTitle>
              <Card>{dossier.likelyPriorities.map((p, i) => <Bullet key={i} text={p} tone="accent" />)}</Card>
            </>
          )}

          {dossier.interviewStyle ? (
            <>
              <SectionTitle style={styles.mt}>Possible Interview Style</SectionTitle>
              <Card><Text style={styles.body}>{dossier.interviewStyle}</Text></Card>
            </>
          ) : null}

          {dossier.questionsTheyMayAsk.length > 0 && (
            <>
              <SectionTitle style={styles.mt}>Questions They May Ask</SectionTitle>
              <Card>{dossier.questionsTheyMayAsk.map((q, i) => <Bullet key={i} text={q} />)}</Card>
            </>
          )}

          {dossier.goodTopics.length > 0 && (
            <>
              <SectionTitle style={styles.mt}>Good Topics to Raise</SectionTitle>
              <Card>{dossier.goodTopics.map((q, i) => <Bullet key={i} text={q} />)}</Card>
            </>
          )}

          {dossier.avoid.length > 0 && (
            <>
              <SectionTitle style={styles.mt}>Avoid / Be Careful With</SectionTitle>
              <Card>{dossier.avoid.map((q, i) => <Bullet key={i} text={q} />)}</Card>
            </>
          )}

          {dossier.confidenceNotes.length > 0 && (
            <>
              <SectionTitle style={styles.mt}>Confidence & Source Notes</SectionTitle>
              <Card>
                {dossier.confidenceNotes.map((q, i) => <Bullet key={`c${i}`} text={q} />)}
                {dossier.sourceNotes.map((q, i) => <Bullet key={`s${i}`} text={q} />)}
              </Card>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  dim: { color: colors.textMuted, fontSize: font.body },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  name: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, letterSpacing: -0.3 },
  title: { color: colors.textSecondary, fontSize: font.small, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  actionCard: { marginTop: spacing.lg },
  actionLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: font.semibold, letterSpacing: 0.5, textTransform: "uppercase" },
  actionValue: { color: colors.textPrimary, fontSize: font.body, marginTop: 4, textTransform: "capitalize" },
  mt: { marginTop: spacing.xl },
  body: { color: colors.textPrimary, fontSize: font.body, lineHeight: 24 },
  timeline: { paddingLeft: spacing.sm, borderLeftWidth: 1, borderLeftColor: colors.border, marginLeft: spacing.sm },
  tlRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.lg },
  tlDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, marginLeft: -spacing.sm - 4, marginRight: spacing.md, marginTop: 5 },
  tlText: { flex: 1, color: colors.textSecondary, fontSize: font.small, lineHeight: 21 },
});
