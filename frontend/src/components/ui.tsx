import React from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "../theme";
import { HapticsService } from "../haptics/HapticsService";

/* ---------------- ScreenContainer ---------------- */
export function ScreenContainer({
  children,
  scroll = false,
  style,
  contentStyle,
  edges = ["top", "bottom"],
  testID,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
  testID?: string;
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: spacing.xl, paddingBottom: spacing.xxxl }, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: spacing.xl }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/* ---------------- Button ---------------- */
type ButtonVariant = "white" | "red" | "dark" | "ghost";
export function Button({
  label,
  onPress,
  variant = "white",
  loading = false,
  disabled = false,
  icon,
  haptic = "tap",
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  haptic?: "select" | "tap" | "heavy" | "none";
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = BTN[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        if (haptic !== "none") HapticsService[haptic]();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.borderWidth },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Feather name={icon} size={18} color={v.fg} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.btnLabel, { color: v.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const BTN: Record<ButtonVariant, { bg: string; fg: string; border: string; borderWidth: number }> = {
  white: { bg: colors.white, fg: colors.black, border: colors.white, borderWidth: 0 },
  red: { bg: colors.accent, fg: colors.white, border: colors.accent, borderWidth: 0 },
  dark: { bg: colors.surface, fg: colors.textPrimary, border: colors.border, borderWidth: 1 },
  ghost: { bg: "transparent", fg: colors.textSecondary, border: "transparent", borderWidth: 0 },
};

/* ---------------- Card ---------------- */
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={() => {
          HapticsService.select();
          onPress();
        }}
        style={({ pressed }) => pressed && { opacity: 0.9 }}
      >
        {content}
      </Pressable>
    );
  }
  return <View testID={testID}>{content}</View>;
}

/* ---------------- Badge ---------------- */
export function Badge({
  label,
  tone = "neutral",
  testID,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  testID?: string;
}) {
  const map = {
    neutral: { bg: colors.surfaceRaised, fg: colors.textSecondary, border: colors.border },
    success: { bg: "rgba(32,192,107,0.12)", fg: colors.success, border: "rgba(32,192,107,0.4)" },
    warning: { bg: "rgba(245,184,61,0.12)", fg: colors.warning, border: "rgba(245,184,61,0.4)" },
    danger: { bg: "rgba(255,77,77,0.12)", fg: colors.danger, border: "rgba(255,77,77,0.4)" },
    accent: { bg: "rgba(255,45,45,0.12)", fg: colors.accent, border: "rgba(255,45,45,0.4)" },
  }[tone];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

/* ---------------- Misc ---------------- */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Bullet({ text, tone = "muted" }: { text: string; tone?: "muted" | "accent" }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.dot, { backgroundColor: tone === "accent" ? colors.accent : colors.textMuted }]} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function KeyboardSpacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  btn: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  btnLabel: { fontSize: font.body, fontWeight: font.semibold },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: font.tiny, fontWeight: font.semibold, letterSpacing: 0.3 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: font.h3,
    fontWeight: font.bold,
    marginBottom: spacing.md,
  },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8, marginRight: spacing.md },
  bulletText: { flex: 1, color: colors.textSecondary, fontSize: font.small, lineHeight: 21 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
});
