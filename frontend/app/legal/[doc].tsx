import React from "react";
import { Text, View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font } from "@/src/theme";

const PRIVACY = `DeepPrep Privacy Policy

DeepPrep is provided by ThoughtSnap Labs Ltd.

DeepPrep helps users prepare for professional interviews by creating AI-generated preparation briefs from user-entered interview details and public professional signals.

Information processed may include company name, role, job description, interview date, interviewer names, public search results, anonymous device identifiers, purchase/entitlement status, credit usage, and basic diagnostic/cost logs.

DeepPrep uses this information to generate free Intel Scans and full interview reports, manage subscriptions and credits, prevent abuse, and improve reliability.

DeepPrep is not a background-check, people-search, employment-screening, or hiring decision tool. Public professional data can be incomplete, outdated, or ambiguous; use reports as preparation guidance only.

Full Privacy Policy:
https://thoughtsnaplabs.com/deepprep/privacy

Contact:
https://thoughtsnaplabs.com/support`;

const TERMS = `DeepPrep Terms of Use

DeepPrep Pro is an auto-renewable subscription billed through your Apple ID.

Subscription:
• £7.99 per week
• Includes 6 Intel Credits every week while subscribed
• Subscription renews automatically unless cancelled at least 24 hours before the end of the current period
• You can manage or cancel your subscription in your App Store account settings

DeepPrep is an interview-preparation tool. You agree not to use it to harass, stalk, surveil, or make employment or screening decisions about any person.

Reports are AI-generated and may be incomplete, outdated, or ambiguous. Always verify important details naturally during your interview process.

Apple Standard EULA:
https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

Contact:
https://thoughtsnaplabs.com/support`;

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
