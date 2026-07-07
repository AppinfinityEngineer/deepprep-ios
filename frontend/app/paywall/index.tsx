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

const FEATURES = [
  "Full reports & interviewer dossiers",
  "Day-of brief & smart talking points",
  "Freshness monitoring & alerts",
  "Company intelligence & likely questions",
  "Saved / offline reports",
  "6 Intel Credits every week",
  "Free Intel Scan before subscribing",
];

export default function Paywall() {
  const router = useRouter();
  const { completeOnboarding, unlockPro, restorePurchases } = useApp();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [product, setProduct] = useState<DeepPrepProduct | null>(null);

  useEffect(() => {
    let mounted = true;
    StoreKitService.loadProducts().then((items) => {
      if (mounted) setProduct(items[0] || null);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const onContinue = async () => {
    setLoading(true);
    setMsg(null);
    await HapticsService.heavy();
    try {
      const ent = await unlockPro();
      await completeOnboarding();
      if (ent.active) {
        router.replace("/brief/generating?from=onboarding");
      } else {
        setMsg("Apple is finishing the purchase. If it does not unlock automatically, tap Restore Purchases.");
      }
    } catch {
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
        <Text style={styles.kicker}>DEEPPREP PRO</Text>
        <Text style={styles.title}>Unlock your full interview intel.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featRow}>
              <Feather name="check" size={18} color={colors.accent} />
              <Text style={styles.featText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{product?.priceLabel || StoreKitService.pricing.introPrice}</Text>
            <View style={styles.introTag}>
              <Text style={styles.introTagText}>DeepPrep Pro</Text>
            </View>
          </View>
          <Text style={styles.priceSub}>
            {product?.recurringLabel || `Then ${StoreKitService.pricing.recurringPrice} / ${StoreKitService.pricing.recurringPeriod}`} · Cancel anytime
          </Text>
          <Text style={styles.creditNote}>Includes 6 Intel Credits every week while subscribed.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {msg ? (
          <Text style={styles.msg} testID="paywall-message">
            {msg}
          </Text>
        ) : null}
        <Button label="Start DeepPrep Pro" variant="red" loading={loading} onPress={onContinue} haptic="none" testID="paywall-continue" />
        <Pressable onPress={onRestore} style={styles.restore} testID="restore-purchases">
          <Text style={styles.restoreText}>{restoring ? "Restoring…" : "Restore Purchases"}</Text>
        </Pressable>
        <Text style={styles.legal}>
          Subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Payment is charged to your Apple ID.

          <Text style={styles.link} onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}>Terms of Use</Text>{" · "}
          <Text style={styles.link} onPress={() => Linking.openURL("https://thoughtsnaplabs.com/deepprep/privacy")}>Privacy Policy</Text>
        </Text>
        <Text style={styles.legal}>
          By continuing, you agree to our{" "}
          <Text style={styles.link} onPress={() => router.push("/legal/terms")}>
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text style={styles.link} onPress={() => router.push("/legal/privacy")}>
            Privacy Policy
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
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  price: { color: colors.textPrimary, fontSize: 40, fontWeight: font.bold, letterSpacing: -1 },
  introTag: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  introTagText: { color: colors.white, fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 0.5 },
  priceSub: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm },
  creditNote: { color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.sm },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  msg: { color: colors.danger, fontSize: font.small, textAlign: "center", marginBottom: spacing.md },
  restore: { alignItems: "center", paddingVertical: spacing.md },
  restoreText: { color: colors.textSecondary, fontSize: font.small, fontWeight: font.medium },
  legal: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", lineHeight: 18 },
  link: { color: colors.textSecondary, textDecorationLine: "underline" },
});
