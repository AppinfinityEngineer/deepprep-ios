import React, { useCallback, useState } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";

import { colors, spacing, font, radius } from "@/src/theme";
import { Card, Badge } from "@/src/components/ui";
import { useApp } from "@/src/state/AppContext";
import { StoreKitService } from "@/src/storekit/StoreKitService";
import { DeepPrepApi } from "@/src/api/deepprep";
import { HapticsService } from "@/src/haptics/HapticsService";

export default function Settings() {
  const router = useRouter();
  const { entitlement, deviceId, refreshEntitlement, refreshReports, devResetForTesting, restorePurchases } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) refreshEntitlement();
    }, [deviceId, refreshEntitlement])
  );

  const restore = async () => {
    setBusy("restore");
    setMsg(null);
    try {
      await restorePurchases();
      await refreshEntitlement();
      setMsg("Purchases restored.");
    } catch {
      setMsg("Could not restore purchases.");
    } finally {
      setBusy(null);
    }
  };

  const devReset = async () => {
    setBusy("dev-reset");
    setMsg(null);
    try {
      await devResetForTesting();
      HapticsService.success();
      setMsg("Dev reset complete. A fresh test device ID was created.");
      router.replace("/onboarding");
    } catch {
      setMsg("Could not reset dev scan.");
    } finally {
      setBusy(null);
    }
  };

  const deleteData = async () => {
    setBusy("delete");
    setMsg(null);
    try {
      await DeepPrepApi.privacyDelete(deviceId);
      await refreshReports();
      HapticsService.success();
      setMsg("Your data has been deleted.");
    } catch {
      setMsg("Could not delete data.");
    } finally {
      setBusy(null);
    }
  };

  const version = Constants.expoConfig?.version ?? "3.0.0";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="settings-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Subscription */}
        <Card testID="subscription-card">
          <View style={styles.subRow}>
            <Text style={styles.subTitle}>DeepPrep Pro</Text>
            <Badge label={entitlement?.active ? "ACTIVE" : "INACTIVE"} tone={entitlement?.active ? "success" : "neutral"} />
          </View>
          <Text style={styles.subMeta}>
            {StoreKitService.pricing.recurringPrice} / {StoreKitService.pricing.recurringPeriod} · {entitlement?.creditsRemaining ?? 0} Intel Credits remaining
          </Text>
        </Card>

        <View style={{ height: spacing.lg }} />

        <SettingRow icon="refresh-cw" label={busy === "restore" ? "Restoring…" : "Restore Purchases"} onPress={restore} testID="settings-restore" />
        <SettingRow icon="external-link" label="Manage Apple Subscription" onPress={() => StoreKitService.openManageSubscriptions()} testID="settings-manage-subscription" />
        <SettingRow icon="shield" label="Privacy Policy" onPress={() => router.push("https://thoughtsnaplabs.com/deepprep/privacy")} testID="settings-privacy" />
        <SettingRow icon="file-text" label="Terms of Service" onPress={() => router.push("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} testID="settings-terms" />
        <SettingRow icon="mail" label="Support" onPress={() => Linking.openURL("mailto:support@thoughtsnaplabs.com")} testID="settings-support" />
        {__DEV__ ? (
          <SettingRow icon="rotate-ccw" label={busy === "dev-reset" ? "Resetting dev scan…" : "Reset Dev Scan + Fresh Device"} onPress={devReset} testID="settings-dev-reset" />
        ) : null}
        <SettingRow icon="trash-2" label={busy === "delete" ? "Deleting…" : "Delete My Data"} danger onPress={deleteData} testID="settings-delete" />

        {msg ? <Text style={styles.msg} testID="settings-message">{msg}</Text> : null}

        <Text style={styles.privacyNote}>
          DeepPrep uses publicly available professional information and your interview details to generate
          private preparation briefs.
        </Text>
        <Text style={styles.version}>DeepPrep v{version} · ThoughtSnap Labs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ icon, label, onPress, danger, testID }: { icon: any; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Pressable onPress={() => { HapticsService.select(); onPress(); }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} testID={testID}>
      <Feather name={icon} size={18} color={danger ? colors.danger : colors.textSecondary} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: font.h1, fontWeight: font.bold, letterSpacing: -0.5 },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold },
  subMeta: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, marginBottom: spacing.md,
  },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: font.body, fontWeight: font.medium },
  msg: { color: colors.textSecondary, fontSize: font.small, textAlign: "center", marginTop: spacing.md },
  privacyNote: { color: colors.textMuted, fontSize: font.tiny, lineHeight: 18, marginTop: spacing.xl, textAlign: "center" },
  version: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.lg },
});
