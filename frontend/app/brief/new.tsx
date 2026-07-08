import React, { useState } from "react";
import { Text, View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, font, radius } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { TextField, TextArea } from "@/src/components/inputs";
import { useApp } from "@/src/state/AppContext";
import { Interviewer, emptyDraft } from "@/src/models/types";
import { HapticsService } from "@/src/haptics/HapticsService";

export default function NewBrief() {
  const router = useRouter();
  const { setDraft, resetDraft, entitlement } = useApp();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [date, setDate] = useState("");
  const [jd, setJd] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileText, setProfileText] = useState("");
  const [interviewers, setInterviewers] = useState<Interviewer[]>([{ name: "" }]);

  const update = (i: number, patch: Partial<Interviewer>) =>
    setInterviewers((prev) => prev.map((iv, idx) => (idx === i ? { ...iv, ...patch } : iv)));

  const add = () => {
    if (interviewers.length >= 4) return;
    HapticsService.select();
    setInterviewers((p) => [...p, { name: "" }]);
  };

  const canCreate = company.trim() && role.trim();

  const create = () => {
    resetDraft();
    setDraft({
      ...emptyDraft(),
      company: company.trim(),
      role: role.trim(),
      date: date.trim() || undefined,
      jdText: jd.trim() || undefined,
      profileUrl: profileUrl.trim() || undefined,
      profileText: profileText.trim() || undefined,
      interviewers: interviewers.filter((i) => i.name.trim()),
    });
    router.push("/brief/generating?from=new");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]} testID="new-brief-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="new-brief-back">
          <Feather name="chevron-left" size={26} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.title}>New Brief</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextField label="Company" value={company} onChangeText={setCompany} placeholder="Company name" testID="nb-company" autoCapitalize="words" />
          <TextField label="Role" value={role} onChangeText={setRole} placeholder="Role you’re interviewing for" testID="nb-role" autoCapitalize="words" />
          <TextField label="Interview date" value={date} onChangeText={setDate} placeholder="Interview date" testID="nb-date" />

          <Text style={styles.label}>Interviewers (optional)</Text>
          {interviewers.map((iv, i) => (
            <View key={i} style={styles.ivCard}>
              <TextField label={`Interviewer ${i + 1}`} value={iv.name} onChangeText={(t) => update(i, { name: t })} placeholder="Interviewer name" testID={`nb-iv-name-${i}`} autoCapitalize="words" />
              <TextField label="Title (optional)" value={iv.title || ""} onChangeText={(t) => update(i, { title: t })} placeholder="Interviewer job title" testID={`nb-iv-title-${i}`} />
              <TextField label="LinkedIn / profile URL (optional)" value={iv.linkedinUrl || ""} onChangeText={(t) => update(i, { linkedinUrl: t })} placeholder="Optional profile URL" autoCapitalize="none" autoCorrect={false} testID={`nb-iv-url-${i}`} />
            </View>
          ))}
          {interviewers.length < 4 ? (
            <Pressable onPress={add} style={styles.addRow} testID="nb-add-interviewer">
              <Feather name="plus" size={18} color={colors.accent} />
              <Text style={styles.addText}>Add another interviewer</Text>
            </Pressable>
          ) : null}

          <TextArea label="Job description (optional)" value={jd} onChangeText={setJd} placeholder="Paste job description or key responsibilities" testID="nb-jd" />
          <TextField label="Primary interviewer LinkedIn / profile URL (optional)" value={profileUrl} onChangeText={setProfileUrl} placeholder="Optional profile URL" autoCapitalize="none" autoCorrect={false} testID="nb-profile" />
          <TextArea label="Primary interviewer profile text / headline (optional)" value={profileText} onChangeText={setProfileText} placeholder="Paste current profile headline or public profile text" maxLength={4000} testID="nb-profile-text" />

          <Text style={styles.creditHint}>
            {interviewers.filter((i) => i.name.trim()).length >= 3 ? "Panel brief — 2 credits" : "Standard brief — 1 credit"} ·{" "}
            {entitlement?.creditsRemaining ?? 0} remaining
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Create Brief" variant="white" onPress={create} disabled={!canCreate} testID="create-brief" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  title: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold },
  label: { color: colors.textSecondary, fontSize: font.small, fontWeight: font.medium, marginBottom: spacing.sm },
  ivCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  addText: { color: colors.accent, fontSize: font.body, fontWeight: font.semibold },
  creditHint: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.md },
  footer: { padding: spacing.xl, paddingTop: spacing.md },
});
