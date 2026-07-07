import React, { useEffect, useRef } from "react";
import { Text, View, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, font } from "@/src/theme";
import { useApp } from "@/src/state/AppContext";
import { RadarMark } from "@/src/components/RadarMark";

export default function Index() {
  const router = useRouter();
  const { ready, onboardingDone, entitlement, reports, pendingReportJob } = useApp();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      if (pendingReportJob?.interviewId) {
        router.replace(`/brief/generating?resume=1&interviewId=${pendingReportJob.interviewId}`);
        return;
      }

      // Critical: an active TestFlight/App Store subscription must never skip onboarding.
      // Users still need to create a brief before the app has anything to show.
      if (!onboardingDone) {
        router.replace("/onboarding");
        return;
      }

      if (reports.length > 0) {
        router.replace("/(tabs)");
        return;
      }

      if (entitlement?.active) {
        router.replace("/brief/new");
        return;
      }

      router.replace("/paywall");
    }, 1100);
    return () => clearTimeout(t);
  }, [ready, onboardingDone, entitlement, reports.length, pendingReportJob, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Animated.View style={{ opacity: fade, alignItems: "center" }}>
        <RadarMark size={110} />
        <Text style={styles.brand}>
          Deep<Text style={{ color: colors.accent }}>Prep</Text>
        </Text>
        <Text style={styles.tag}>Interview intelligence from public web research.</Text>
      </Animated.View>
      <View style={styles.footer}>
        <View style={styles.accentLine} />
        <Text style={styles.labs}>THOUGHTSNAP LABS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  brand: { color: colors.textPrimary, fontSize: 40, fontWeight: font.bold, marginTop: spacing.xl, letterSpacing: -0.5 },
  tag: { color: colors.textSecondary, fontSize: font.small, marginTop: spacing.sm, textAlign: "center", maxWidth: 240 },
  footer: { position: "absolute", bottom: 56, alignItems: "center" },
  accentLine: { width: 40, height: 3, backgroundColor: colors.accent, borderRadius: 2, marginBottom: spacing.md },
  labs: { color: colors.textMuted, fontSize: font.tiny, letterSpacing: 2 },
});
