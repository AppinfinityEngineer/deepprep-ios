import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppProvider } from "@/src/state/AppContext";
import { colors } from "@/src/theme";

// Keep useful warnings visible. Only suppress known noisy development warnings.
if (__DEV__) {
  LogBox.ignoreLogs(["VirtualizedLists should never be nested"]);
}

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [splashReleased, setSplashReleased] = useState(false);

  useEffect(() => {
    let mounted = true;
    const release = () => {
      if (!mounted) return;
      setSplashReleased(true);
      SplashScreen.hideAsync().catch(() => {});
    };

    const fallback = setTimeout(release, 1800);
    if (loaded || error) release();

    return () => {
      mounted = false;
      clearTimeout(fallback);
    };
  }, [loaded, error]);

  if (!loaded && !error && !splashReleased) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "slide_from_right",
            }}
          />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
