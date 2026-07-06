import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, font, radius } from "@/src/theme";
import { Button, Bullet } from "@/src/components/ui";
import { OptionRow, Chip } from "@/src/components/OptionRow";
import { TextField, TextArea } from "@/src/components/inputs";
import { ProgressDots } from "@/src/components/ProgressDots";
import { RadarMark } from "@/src/components/RadarMark";
import { useApp } from "@/src/state/AppContext";
import { Interviewer } from "@/src/models/types";
import { HapticsService } from "@/src/haptics/HapticsService";

const SITUATIONS = ["Actively interviewing", "Applying now", "Final round coming up", "Exploring roles"];
const LEVELS = ["Junior", "Mid-level", "Senior", "Lead / Principal", "Manager / Director"];
const INDUSTRIES = ["Engineering", "Data", "Product", "Design", "Sales", "Marketing", "Finance", "Operations", "Other"];
const CONCERNS = ["Technical depth", "System design", "Company research", "The interviewer", "Talking points", "Tough questions"];

const TOTAL_STEPS = 9;

export default function Onboarding() {
  const router = useRouter();
  const { draft, setDraft } = useApp();
  const [step, setStep] = useState(0);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([{ name: "" }]);

  const next = () => {
    HapticsService.tap();
    if (step === 8) {
      setDraft({ interviewers: interviewers.filter((i) => i.name.trim()) });
      router.push("/onboarding/scan");
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };
  const back = () => {
    if (step === 0) return;
    HapticsService.select();
    setStep((s) => s - 1);
  };

  const canContinue = () => {
    if (step === 4) return draft.company.trim().length > 0 && draft.role.trim().length > 0;
    if (step === 6) return interviewers.some((i) => i.name.trim().length > 0);
    return true;
  };

  const toggleConcern = (c: string) => {
    const set = new Set(draft.concerns);
    if (set.has(c)) {
      set.delete(c);
    } else {
      set.add(c);
    }
    setDraft({ concerns: Array.from(set) });
  };

  const updateInterviewer = (idx: number, patch: Partial<Interviewer>) => {
    setInterviewers((prev) => prev.map((iv, i) => (i === idx ? { ...iv, ...patch } : iv)));
  };
  const addInterviewer = () => {
    if (interviewers.length >= 4) return;
    HapticsService.select();
    setInterviewers((prev) => [...prev, { name: "" }]);
  };

  const ctaLabel = step === 0 ? "Get Started" : step === 8 ? "Build Free Intel Scan" : "Continue";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} style={{ opacity: step === 0 ? 0 : 1 }} testID="onboarding-back">
          <Feather name="chevron-left" size={26} color={colors.textSecondary} />
        </Pressable>
        <ProgressDots total={TOTAL_STEPS} index={step} />
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <StepContent
            step={step}
            draft={draft}
            setDraft={setDraft}
            toggleConcern={toggleConcern}
            interviewers={interviewers}
            updateInterviewer={updateInterviewer}
            addInterviewer={addInterviewer}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={ctaLabel}
            variant="white"
            onPress={next}
            disabled={!canContinue()}
            testID="onboarding-continue"
          />
          {step === 8 ? (
            <Text style={styles.skipHint} testID="onboarding-scan-hint">
              This usually takes 20–40 seconds.
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepContent(props: any) {
  const { step, draft, setDraft, toggleConcern, interviewers, updateInterviewer, addInterviewer } = props;

  switch (step) {
    case 0:
      return (
        <View testID="onboarding-welcome">
          <RadarMark size={72} />
          <Text style={styles.h1}>Walk into interviews prepared.</Text>
          <Text style={styles.sub}>
            DeepPrep researches the company, role, and people interviewing you so you can walk in with
            context, confidence, and an edge.
          </Text>
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Bullet text="Interviewer dossiers from public professional data" tone="accent" />
            <Bullet text="Likely questions & smart talking points" tone="accent" />
            <Bullet text="Honest confidence & freshness checks" tone="accent" />
          </View>
        </View>
      );
    case 1:
      return (
        <StepBlock title="Where are you in your job search?">
          {SITUATIONS.map((s) => (
            <OptionRow
              key={s}
              title={s}
              selected={draft.jobSituation === s}
              onPress={() => setDraft({ jobSituation: s })}
              testID={`situation-${s}`}
            />
          ))}
        </StepBlock>
      );
    case 2:
      return (
        <StepBlock title="What level are you targeting?">
          {LEVELS.map((s) => (
            <OptionRow key={s} title={s} selected={draft.roleLevel === s} onPress={() => setDraft({ roleLevel: s })} testID={`level-${s}`} />
          ))}
        </StepBlock>
      );
    case 3:
      return (
        <StepBlock title="What kind of role is this?">
          {INDUSTRIES.map((s) => (
            <OptionRow key={s} title={s} selected={draft.industry === s} onPress={() => setDraft({ industry: s })} testID={`industry-${s}`} />
          ))}
        </StepBlock>
      );
    case 4:
      return (
        <StepBlock title="Which company & role?" subtitle="This personalises your intel.">
          <TextField label="Company" value={draft.company} onChangeText={(t: string) => setDraft({ company: t })} placeholder="Confused.com" testID="input-company" autoCapitalize="words" />
          <TextField label="Role title" value={draft.role} onChangeText={(t: string) => setDraft({ role: t })} placeholder="Senior Data Engineer" testID="input-role" autoCapitalize="words" />
        </StepBlock>
      );
    case 5:
      return (
        <StepBlock title="When is your interview?">
          <TextField label="Interview date" value={draft.date || ""} onChangeText={(t: string) => setDraft({ date: t })} placeholder="e.g. 30 May 2026" testID="input-date" />
          <Text style={[styles.label, { marginTop: spacing.md }]}>What is your biggest concern?</Text>
          <View style={styles.chipsWrap}>
            {CONCERNS.map((c) => (
              <Chip key={c} label={c} selected={draft.concerns.includes(c)} onPress={() => toggleConcern(c)} testID={`concern-${c}`} />
            ))}
          </View>
        </StepBlock>
      );
    case 6:
      return (
        <StepBlock title="Who will you be speaking with?" subtitle="Add any known information. Up to 4 interviewers.">
          {interviewers.map((iv: Interviewer, idx: number) => (
            <View key={idx} style={styles.ivCard} testID={`interviewer-card-${idx}`}>
              <TextField label={`Interviewer ${idx + 1}`} value={iv.name} onChangeText={(t: string) => updateInterviewer(idx, { name: t })} placeholder="Nick Sharp" testID={`interviewer-name-${idx}`} autoCapitalize="words" />
              <TextField label="Title (optional)" value={iv.title || ""} onChangeText={(t: string) => updateInterviewer(idx, { title: t })} placeholder="Director of Data & Technology" testID={`interviewer-title-${idx}`} />
              <TextField label="LinkedIn / profile URL (optional)" value={iv.linkedinUrl || ""} onChangeText={(t: string) => updateInterviewer(idx, { linkedinUrl: t })} placeholder="https://linkedin.com/in/…" autoCapitalize="none" autoCorrect={false} testID={`interviewer-url-${idx}`} />
            </View>
          ))}
          {interviewers.length < 4 ? (
            <Pressable onPress={addInterviewer} style={styles.addRow} testID="add-interviewer">
              <Feather name="plus" size={18} color={colors.accent} />
              <Text style={styles.addText}>Add another interviewer</Text>
            </Pressable>
          ) : null}
        </StepBlock>
      );
    case 7:
      return (
        <StepBlock title="Paste the job description" subtitle="This helps DeepPrep generate role-specific questions and talking points.">
          <TextArea value={draft.jdText || ""} onChangeText={(t: string) => setDraft({ jdText: t })} placeholder="Paste the description or key responsibilities here…" testID="input-jd" />
          <Text style={styles.uploadHint}>Paste-only for v1. No uploads are required for your scan.</Text>
        </StepBlock>
      );
    case 8:
      return (
        <StepBlock
          title="Add LinkedIn or profile evidence"
          subtitle="Fresh profile evidence helps DeepPrep avoid stale public data. In v1 this applies to the first interviewer in your scan. You can skip this."
        >
          <TextField label="Paste LinkedIn / profile URL" value={draft.profileUrl || ""} onChangeText={(t: string) => setDraft({ profileUrl: t })} placeholder="https://linkedin.com/in/…" autoCapitalize="none" autoCorrect={false} testID="input-profile-url" />
          <TextArea label="Paste profile text / headline" value={draft.profileText || ""} onChangeText={(t: string) => setDraft({ profileText: t })} placeholder="Paste the interviewer's current headline or profile text…" maxLength={4000} testID="input-profile-text" />
          <Text style={styles.uploadHint}>DeepPrep labels this as user-supplied evidence, not externally verified data.</Text>
        </StepBlock>
      );
    default:
      return null;
  }
}

function StepBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.h2}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      <View style={{ marginTop: spacing.xl }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  h1: { color: colors.textPrimary, fontSize: font.h1, fontWeight: font.bold, marginTop: spacing.xl, letterSpacing: -0.5, lineHeight: 40 },
  h2: { color: colors.textPrimary, fontSize: font.h2, fontWeight: font.bold, letterSpacing: -0.3, lineHeight: 32 },
  sub: { color: colors.textSecondary, fontSize: font.body, marginTop: spacing.md, lineHeight: 23 },
  label: { color: colors.textSecondary, fontSize: font.small, fontWeight: font.medium, marginBottom: spacing.sm },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  ivCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, gap: spacing.sm },
  addText: { color: colors.accent, fontSize: font.body, fontWeight: font.semibold },
  uploadHint: { color: colors.textMuted, fontSize: font.tiny, marginTop: -spacing.sm },
  skipHint: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.md },
});
