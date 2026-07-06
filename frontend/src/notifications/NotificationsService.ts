// Notification scheduling — stubbed for a future branch.
// TODO(branch-8): wire real permissions + expo-notifications scheduling.
// This feature only works in a dev/production build, NOT Expo Go.
import * as Notifications from "expo-notifications";

export type InterviewNotificationType =
  | "brief_ready" // T-3 days
  | "review_talking_points" // T-1 day
  | "day_of" // morning of
  | "post_interview"; // after

export const NotificationsService = {
  // Returns granted status without forcing a request (contextual request happens
  // in the Alerts screen). Stubbed cleanly if permissions aren't set up.
  async getStatus(): Promise<Notifications.PermissionStatus | "unavailable"> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch {
      return "unavailable";
    }
  },

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    } catch {
      return false;
    }
  },

  // TODO(branch-8): schedule real local notifications relative to interview date.
  async scheduleForInterview(_interviewDateIso: string) {
    // no-op stub
  },
};
