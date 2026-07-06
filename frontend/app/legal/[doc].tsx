import React from "react";
import { Text, View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font } from "@/src/theme";

const PRIVACY = `DeepPrep Privacy Policy (Placeholder)

DeepPrep uses publicly available professional information and the interview details you provide to generate private interview-preparation briefs.

What we use
• Company, role, interview date and interviewer details you enter.
• Optional job descriptions and profile evidence you paste.
• Publicly available professional web information.

What we do not do
• We do not sell your personal data.
• We do not claim to reveal private, hidden, or confidential information.
• We do not encourage surveillance of any individual.

Your data
• Reports are stored so you can view them across sessions and offline.
• You can delete your data at any time from Settings → Delete My Data.
• A minimal irreversible fraud-prevention record may be retained to prevent abuse of the free scan.

TODO: Replace this placeholder with your production privacy policy before App Store submission.

Contact: support@thoughtsnaplabs.com`;

const TERMS = `DeepPrep Terms of Service (Placeholder)

By using DeepPrep you agree to the following:

Subscription
• DeepPrep Pro is offered at £1.99 for the first 3 days, then £7.99 per week.
• Subscriptions renew automatically until cancelled.
• You can cancel anytime in your App Store settings.

Acceptable use
• DeepPrep is an interview-preparation tool using public professional data.
• You agree not to use it to harass, stalk, or surveil any individual.

Accuracy
• DeepPrep is honest about confidence and freshness. Public data may be out of date; always confirm details naturally during your interview.

TODO: Replace this placeholder with your production terms before App Store submission.

Contact: support@thoughtsnaplabs.com`;

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const isPrivacy = doc === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
  const content = isPrivacy ? PRIVACY : TERMS;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="legal-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="legal-back">
          <Feather name="chevron-left" size={26} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.hTitle}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{content}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hTitle: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold },
  body: { color: colors.textSecondary, fontSize: font.small, lineHeight: 24 },
});
