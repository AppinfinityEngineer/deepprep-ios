// Centralised haptics. Never throws; safely no-ops on web / unsupported.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const enabled = Platform.OS !== "web";

async function safe(fn: () => Promise<void>) {
  if (!enabled) return;
  try {
    await fn();
  } catch {
    // ignore
  }
}

export const HapticsService = {
  // light tap — option selection, onboarding continue
  select: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // medium — primary CTA, credit use
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  // heavy — paywall CTA
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  // success — report ready, scan step complete, copy, positive review
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
