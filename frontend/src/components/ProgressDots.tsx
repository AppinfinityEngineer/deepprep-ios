import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, spacing, radius } from "../theme";

export function ProgressDots({ total, index }: { total: number; index: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index && styles.active,
            i < index && styles.done,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.border },
  active: { width: 22, backgroundColor: colors.accent },
  done: { backgroundColor: colors.textMuted },
});
