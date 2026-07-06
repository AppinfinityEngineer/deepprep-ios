import React from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "../theme";
import { HapticsService } from "../haptics/HapticsService";

/* Single-select option row with title/subtitle + chevron or check. */
export function OptionRow({
  title,
  subtitle,
  selected,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        HapticsService.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, selected && { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? (
        <Feather name="check" size={20} color={colors.accent} />
      ) : (
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

/* Multi-select chip (used for concerns). */
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        HapticsService.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 60,
  },
  rowSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  title: { color: colors.textPrimary, fontSize: font.body, fontWeight: font.semibold },
  subtitle: { color: colors.textSecondary, fontSize: font.small, marginTop: 2 },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 44,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: font.small, fontWeight: font.medium },
});
