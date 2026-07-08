// Screenshot/demo mode is used only for App Store screenshots and internal demos.
// Keep EXPO_PUBLIC_SCREENSHOT_MODE=false for normal TestFlight/App Store builds.
const ENV_SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "true";

let runtimeScreenshotMode = false;

export const SCREENSHOT_MODE = ENV_SCREENSHOT_MODE;

export function isScreenshotMode() {
  return ENV_SCREENSHOT_MODE || runtimeScreenshotMode;
}

export function enableRuntimeScreenshotMode() {
  runtimeScreenshotMode = true;
}

export function disableRuntimeScreenshotMode() {
  runtimeScreenshotMode = false;
}
