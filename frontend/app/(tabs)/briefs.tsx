import React, { useCallback } from "react";
import { Text, View, StyleSheet, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font } from "@/src/theme";
import { Card, Badge } from "@/src/components/ui";
import { useApp } from "@/src/state/AppContext";
import { timeAgo } from "@/src/utils/time";

export default function Briefs() {
  const router = useRouter();
  const { reports, refreshReports, deviceId } = useApp();

  useFocusEffect(
    useCallback(() => {
      if (deviceId) refreshReports();
    }, [deviceId, refreshReports])
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="briefs-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Briefs</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {reports.length === 0 ? (
          <Card style={styles.empty}>
            <Feather name="file-text" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No briefs yet</Text>
            <Text style={styles.emptySub}>Your generated interview briefs will appear here.</Text>
          </Card>
        ) : (
          reports.map((r) => (
            <Card key={r.id} style={styles.row} onPress={() => router.push(`/report/${r.id}`)} testID={`brief-item-${r.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.company}>{r.company}</Text>
                <Text style={styles.role}>{r.role}</Text>
                <Text style={styles.meta}>Updated {timeAgo(r.generatedAt)}</Text>
              </View>
              <Badge label={`${r.dossiers.length} dossier${r.dossiers.length === 1 ? "" : "s"}`} tone="neutral" />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: font.h1, fontWeight: font.bold, letterSpacing: -0.5 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  company: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold },
  role: { color: colors.textSecondary, fontSize: font.small, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, marginTop: spacing.xxl },
  emptyTitle: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold, marginTop: spacing.md },
  emptySub: { color: colors.textSecondary, fontSize: font.small, textAlign: "center", marginTop: spacing.xs },
});
