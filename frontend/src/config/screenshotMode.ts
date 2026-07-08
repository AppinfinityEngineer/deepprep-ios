// Screenshot/demo mode is used only for App Store screenshots and internal demos.
// Keep EXPO_PUBLIC_SCREENSHOT_MODE=false for normal TestFlight/App Store builds.
export const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "true";
