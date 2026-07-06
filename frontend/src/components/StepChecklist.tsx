import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "../theme";
import { HapticsService } from "../haptics/HapticsService";

/**
 * Animated sequential progress theatre. Advances through `steps`, firing a
 * success haptic as each completes, then calls onDone. `stepMs` controls pace.
 */
export function StepChecklist({
  steps,
  stepMs = 1600,
  onDone,
}: {
  steps: string[];
  stepMs?: number;
  onDone?: () => void;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (current >= steps.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => {
      HapticsService.success();
      setCurrent((c) => c + 1);
    }, stepMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <View style={{ gap: spacing.md }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.row}>
            <View style={[styles.icon, done && styles.iconDone, active && styles.iconActive]}>
              {done ? (
                <Feather name="check" size={16} color={colors.white} />
              ) : active ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View style={styles.pending} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                (done || active) && { color: colors.textPrimary },
                active && { fontWeight: font.semibold },
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    backgroundColor: colors.surface,
  },
  iconActive: { borderColor: colors.accent },
  iconDone: { backgroundColor: colors.success, borderColor: colors.success },
  pending: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  label: { color: colors.textSecondary, fontSize: font.body },
});
