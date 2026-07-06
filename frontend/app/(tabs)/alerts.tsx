import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font, radius } from "@/src/theme";
import { Card, Button } from "@/src/components/ui";
import { NotificationsService } from "@/src/notifications/NotificationsService";

const ALERTS = [
  { icon: "clock", title: "3 days before", text: "Your brief is ready — review the dossiers." },
  { icon: "message-square", title: "1 day before", text: "Review your talking points." },
  { icon: "sunrise", title: "Morning of interview", text: "Open your Day-of Brief." },
  { icon: "check-circle", title: "After the interview", text: "How did it go?" },
] as const;

export default function Alerts() {
  const [status, setStatus] = useState<string>("unknown");

  useEffect(() => {
    (async () => setStatus(await NotificationsService.getStatus()))();
  }, []);

  const enable = async () => {
    const ok = await NotificationsService.requestPermission();
    setStatus(ok ? "granted" : "denied");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="alerts-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          DeepPrep can remind you at the moments that matter before and after your interview.
        </Text>

        {ALERTS.map((a) => (
          <Card key={a.title} style={styles.row}>
            <View style={styles.iconWrap}>
              <Feather name={a.icon as any} size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{a.title}</Text>
              <Text style={styles.rowText}>{a.text}</Text>
            </View>
          </Card>
        ))}

        {status !== "granted" ? (
          <Button label="Enable reminders" variant="dark" icon="bell" onPress={enable} style={{ marginTop: spacing.lg }} testID="enable-alerts" />
        ) : (
          <View style={styles.enabled}>
            <Feather name="check" size={16} color={colors.success} />
            <Text style={styles.enabledText}>Reminders enabled</Text>
          </View>
        )}
        <Text style={styles.note}>Reminders are scheduled on your device. This feature activates in a full build.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: font.h1, fontWeight: font.bold, letterSpacing: -0.5 },
  intro: { color: colors.textSecondary, fontSize: font.body, lineHeight: 23, marginBottom: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  rowTitle: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold },
  rowText: { color: colors.textSecondary, fontSize: font.small, marginTop: 2 },
  enabled: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg },
  enabledText: { color: colors.success, fontSize: font.small, fontWeight: font.medium },
  note: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.lg },
});
