import React from "react";
import { View } from "react-native";
import { colors } from "../theme";

// DeepPrep radar / target mark — concentric rings + red core + crosshair ticks.
export function RadarMark({ size = 96 }: { size?: number }) {
  const rings = [1, 0.62, 0.3];
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {rings.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: size * r,
            height: size * r,
            borderRadius: (size * r) / 2,
            borderWidth: i === 0 ? 2 : 1,
            borderColor: i === 0 ? colors.accent : colors.border,
          }}
        />
      ))}
      <View style={{ width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06, backgroundColor: colors.accent }} />
      <View style={{ position: "absolute", width: 2, height: size * 0.14, backgroundColor: colors.accent, top: -size * 0.06 }} />
      <View style={{ position: "absolute", width: 2, height: size * 0.14, backgroundColor: colors.accent, bottom: -size * 0.06 }} />
      <View style={{ position: "absolute", height: 2, width: size * 0.14, backgroundColor: colors.accent, left: -size * 0.06 }} />
      <View style={{ position: "absolute", height: 2, width: size * 0.14, backgroundColor: colors.accent, right: -size * 0.06 }} />
    </View>
  );
}
