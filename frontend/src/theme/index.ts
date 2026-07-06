// DeepPrep design tokens — premium black-and-white, single red accent.
import { Platform } from "react-native";

export const colors = {
  background: "#050505",
  surface: "#111111",
  surfaceRaised: "#171717",
  border: "#2A2A2A",
  borderStrong: "#6B6B6B",
  textPrimary: "#F5F5F5",
  textSecondary: "#A3A3A3",
  textMuted: "#6B6B6B",
  accent: "#FF2D2D",
  success: "#20C06B",
  warning: "#F5B83D",
  danger: "#FF4D4D",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

const systemFont = Platform.select({ ios: "System", default: "System" });

export const font = {
  family: systemFont,
  // sizes
  h1: 34,
  h2: 26,
  h3: 20,
  body: 16,
  small: 14,
  tiny: 12,
  // weights
  bold: "700" as const,
  semibold: "600" as const,
  medium: "500" as const,
  regular: "400" as const,
};

export const theme = { colors, spacing, radius, font };
export type Theme = typeof theme;
