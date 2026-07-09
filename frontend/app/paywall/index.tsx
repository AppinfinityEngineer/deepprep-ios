import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font, radius } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { useApp } from "@/src/state/AppContext";
import { StoreKitService, type DeepPrepProduct } from "@/src/storekit/StoreKitService";
import { HapticsService } from "@/src/haptics/HapticsService";
import { APPLE_STANDARD_EULA_URL, PRIVACY_POLICY_URL } from "@/src/config/legal";
import { DeepPrepApi } from "@/src/api/deepprep";

const FEATURES = [
  "Full reports & interviewer dossiers",
  "Day-of brief & smart talking points",
  "Company intelligence & likely questions",
  "6 Intel Credits every week",
];

export default function Paywall() {
  const router = useRouter();
  const { deviceId, completeOnboarding, unlockPro, restorePurchases } = useApp();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [product, setProduct] = useState<DeepPrepProduct | null>(null);

  useEffect(() => {
    if (deviceId) DeepPrepApi.trackLiveOpsEvent(deviceId, "paywall_viewed", { productId: StoreKitService.productId }).catch(() => {});
    let mounted = true;
    StoreKitService.loadProducts().then((items) => {
      if (mounted) setProduct(items[0] || null);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [deviceId]);

  const onContinue = async () => {
    setLoading(true);
    setMsg(null);
    await HapticsService.heavy();
    try {
      DeepPrepApi.trackLiveOpsEvent(deviceId, "purchase_started", { productId: StoreKitService.productId, plan: "weekly" }).catch(() => {});
      const ent = await unlockPro();
      await completeOnboarding();
      if (ent.active) {
        router.replace("/brief/generating?from=onboarding");
      } else {
        setMsg("Apple may still be finishing the purchase. Tap Restore Purchases in a moment if your report does not unlock automatically.");
      }
    } catch {
      DeepPrepApi.trackLiveOpsEvent(deviceId, "purchase_failed", { productId: StoreKitService.productId, plan: "weekly" }).catch(() => {});
      setMsg("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRestore = async () => {
    setRestoring(true);
    setMsg(null);
    try {
      const ent = await restorePurchases();
      if (ent.active) {
        DeepPrepApi.trackLiveOpsEvent(deviceId, "restore_success", { productId: StoreKitService.productId, plan: "weekly" }).catch(() => {});
        await completeOnboarding();
        router.replace("/(tabs)");
      } else {
        setMsg("No active subscription found to restore.");
      }
    } catch {
      setMsg("Could not restore purchases.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]} testID="paywall-screen">
      {/* NOTE: Hard paywall — intentionally NO close / X button. */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>UNLOCK FULL INTEL</Text>
        <Text style={styles.title}>Get the edge. Every interview.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featRow}>
              <Feather name="check" size={18} color={colors.accent} />
              <Text style={styles.featText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.planName}>DeepPrep Pro</Text>
          <Text style={styles.price}>{product?.recurringLabel || StoreKitService.pricing.displayLine}</Text>
          <Text style={styles.creditNote}>Includes 6 Intel Credits every week.</Text>
          <Text style={styles.priceSub}>Subscription renews automatically. Payment is charged to your Apple ID. Renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Apple account settings.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {msg ? (
          <Text style={styles.msg} testID="paywall-message">
            {msg}
          </Text>
        ) : null}
        <Button label="Continue to Full Report" variant="red" loading={loading} onPress={onContinue} haptic="none" testID="paywall-continue" />
        <Pressable onPress={onRestore} style={styles.restore} testID="restore-purchases">
          <Text style={styles.restoreText}>{restoring ? "Restoring…" : "Restore Purchases"}</Text>
        </Pressable>
        <Text style={styles.legal}>
          DeepPrep Pro costs £7.99/week and includes 6 Intel Credits every week. By continuing, you agree to the {" "}
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            Privacy Policy
          </Text>{" "}
          and {" "}
          <Text style={styles.link} onPress={() => Linking.openURL(APPLE_STANDARD_EULA_URL)}>
            Apple Standard EULA
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  body: { padding: spacing.xl, paddingTop: spacing.xxl },
  kicker: { color: colors.accent, fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 2 },
  title: { color: colors.textPrimary, fontSize: font.h1, fontWeight: font.bold, letterSpacing: -0.5, marginTop: spacing.md, lineHeight: 40 },
  features: { marginTop: spacing.xl, gap: spacing.md },
  featRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  featText: { color: colors.textPrimary, fontSize: font.body, flex: 1 },
  priceCard: { marginTop: spacing.xxl, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.xl },
  planName: { color: colors.accent, fontSize: font.small, fontWeight: font.bold, letterSpacing: 1 },
  price: { color: colors.textPrimary, fontSize: 34, fontWeight: font.bold, letterSpacing: -0.5, marginTop: spacing.sm },
  priceSub: { color: colors.textSecondary, fontSize: font.tiny, marginTop: spacing.sm, lineHeight: 18 },
  creditNote: { color: colors.textPrimary, fontSize: font.small, marginTop: spacing.sm, fontWeight: font.medium },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  msg: { color: colors.textSecondary, fontSize: font.small, textAlign: "center", marginBottom: spacing.md, lineHeight: 18 },
  restore: { alignItems: "center", paddingVertical: spacing.md },
  restoreText: { color: colors.textSecondary, fontSize: font.small, fontWeight: font.medium },
  legal: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", lineHeight: 18 },
  link: { color: colors.textSecondary, textDecorationLine: "underline" },
});
