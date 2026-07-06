import React, { useCallback } from "react";
import { Text, View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font, radius } from "@/src/theme";
import { Card, Button } from "@/src/components/ui";
import { useApp } from "@/src/state/AppContext";
import { timeAgo, daysUntil } from "@/src/utils/time";

export default function Home() {
  const router = useRouter();
  const { reports, entitlement, draft, refreshReports, refreshEntitlement, deviceId } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) {
        refreshReports();
        refreshEntitlement();
      }
    }, [deviceId, refreshReports, refreshEntitlement])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshReports(), refreshEntitlement()]);
    setRefreshing(false);
  };

  const next = reports[0];
  const days = draft.date ? daysUntil(draft.date) : null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="home-screen">
      <View style={styles.header}>
        <Text style={styles.brand}>
          Deep<Text style={{ color: colors.accent }}>Prep</Text>
        </Text>
        <View style={styles.creditsPill} testID="credits-pill">
          <Feather name="zap" size={13} color={colors.accent} />
          <Text style={styles.creditsText}>{entitlement?.creditsRemaining ?? 0} credits</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        <Text style={styles.sectionLabel}>NEXT INTERVIEW</Text>
        {next ? (
          <Card style={styles.hero} onPress={() => router.push(`/report/${next.id}`)} testID="next-interview-card">
            <View style={{ flex: 1 }}>
              <Text style={styles.heroCompany}>{next.company}</Text>
              <Text style={styles.heroRole}>{next.role}</Text>
              <Text style={styles.heroMeta}>Updated {timeAgo(next.generatedAt)}</Text>
            </View>
            {days !== null ? (
              <View style={styles.countdown}>
                <Text style={styles.countNum}>{days}</Text>
                <Text style={styles.countLabel}>DAYS</Text>
              </View>
            ) : (
              <Feather name="chevron-right" size={22} color={colors.textMuted} />
            )}
          </Card>
        ) : (
          <Card style={styles.empty} testID="home-empty">
            <Feather name="target" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No briefs yet</Text>
            <Text style={styles.emptySub}>Create your first full interview brief to get started.</Text>
          </Card>
        )}

        <Button
          label="New Brief"
          variant="white"
          icon="plus"
          onPress={() => router.push("/brief/new")}
          style={{ marginTop: spacing.xl }}
          testID="new-brief-button"
        />

        {reports.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>RECENT BRIEFS</Text>
            {reports.map((r) => (
              <Card key={r.id} style={styles.briefRow} onPress={() => router.push(`/report/${r.id}`)} testID={`brief-${r.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.briefCompany}>{r.company}</Text>
                  <Text style={styles.briefRole}>{r.role}</Text>
                </View>
                <Text style={styles.briefMeta}>{timeAgo(r.generatedAt)}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  brand: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, letterSpacing: -0.5 },
  creditsPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  creditsText: { color: colors.textPrimary, fontSize: font.tiny, fontWeight: font.semibold },
  sectionLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 1.5, marginBottom: spacing.md },
  hero: { flexDirection: "row", alignItems: "center", padding: spacing.xl },
  heroCompany: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold },
  heroRole: { color: colors.textSecondary, fontSize: font.body, marginTop: 4 },
  heroMeta: { color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.md },
  countdown: { alignItems: "center", marginLeft: spacing.lg },
  countNum: { color: colors.textPrimary, fontSize: 32, fontWeight: font.bold },
  countLabel: { color: colors.textMuted, fontSize: 10, fontWeight: font.bold, letterSpacing: 1 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold, marginTop: spacing.md },
  emptySub: { color: colors.textSecondary, fontSize: font.small, textAlign: "center", marginTop: spacing.xs },
  briefRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  briefCompany: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold },
  briefRole: { color: colors.textSecondary, fontSize: font.small, marginTop: 2 },
  briefMeta: { color: colors.textMuted, fontSize: font.tiny },
});
