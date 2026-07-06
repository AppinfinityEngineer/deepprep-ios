import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { ReviewService } from "@/src/review/ReviewService";
import { HapticsService } from "@/src/haptics/HapticsService";

// Dedicated review/feedback page shown AFTER the free scan result and BEFORE
// the hard paywall. Optional + skippable. Never gates access, never forces a review.
export default function ReviewScreen() {
  const router = useRouter();

  const loveIt = async () => {
    await ReviewService.record("tapped_useful");
    await ReviewService.requestReview();
    router.push("/paywall");
  };

  const cont = () => {
    HapticsService.tap();
    router.push("/paywall");
  };

  return (
    <SafeAreaView style={styles.screen} testID="review-screen">
      <View style={styles.center}>
        <View style={styles.starWrap}>
          <Feather name="star" size={40} color={colors.accent} />
        </View>
        <Text style={styles.title}>Enjoying DeepPrep?</Text>
        <Text style={styles.sub}>
          If this free scan was useful, a full DeepPrep brief is built for each role — 10x deeper. A quick
          review helps us reach more job seekers.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Love it — Leave a Review" variant="white" icon="heart" onPress={loveIt} haptic="none" testID="leave-review" />
        <Button label="Continue to Full Report" variant="dark" onPress={cont} style={{ marginTop: spacing.md }} testID="continue-to-report" />
        <Text style={styles.footNote}>Takes 30 seconds. Reviews are always optional.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  starWrap: {
    width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.xl,
  },
  title: { color: colors.textPrimary, fontSize: font.h1, fontWeight: font.bold, letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: font.body, textAlign: "center", marginTop: spacing.lg, lineHeight: 24, maxWidth: 320 },
  footer: { paddingBottom: spacing.sm },
  footNote: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.lg },
});
