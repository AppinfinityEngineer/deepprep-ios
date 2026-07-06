import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { colors, spacing, radius, font } from "../theme";

export function ConfidenceMeter({
  label,
  percent,
  tone = "success",
}: {
  label: string;
  percent: number;
  tone?: "success" | "warning" | "accent";
}) {
  const color = tone === "warning" ? colors.warning : tone === "accent" ? colors.accent : colors.success;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  label: { color: colors.textSecondary, fontSize: font.small },
  value: { fontSize: font.small, fontWeight: font.bold },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
});
