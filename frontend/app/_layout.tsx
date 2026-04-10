import Constants from "expo-constants";
import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "../constants/theme";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useAuthStore } from "../store/authStore";

function PushNotificationsBootstrap() {
  usePushNotifications();
  return null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[startup] ErrorBoundary captured render error", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.center}>
        <Text style={styles.fallbackTitle}>Something went wrong</Text>
        <Text style={styles.fallbackSubtitle}>
          Restart the app to recover from this startup error.
        </Text>
      </View>
    );
  }
}

export default function RootLayout() {
  const segments = useSegments();
  const { isLoading, token, loadUserFromToken } = useAuthStore();
  const isExpoGo = Constants.appOwnership === "expo";
  const [startupError, setStartupError] = useState<string | null>(null);

  const bootstrapAuth = useCallback(async () => {
    try {
      console.log("[startup] Loading auth session...");
      setStartupError(null);
      await loadUserFromToken();
      console.log("[startup] Auth session loaded");
    } catch (error) {
      console.error("[startup] Failed to load auth session", error);
      setStartupError("Unable to initialize app session");
    }
  }, [loadUserFromToken]);

  useEffect(() => {
    console.log("[startup] RootLayout mounted");
    if (isExpoGo) {
      console.info("Notifications disabled in Expo Go");
    }
  }, [isExpoGo]);

  useEffect(() => {
    void bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const hasToken = !!token;

    try {
      if (hasToken && inAuthGroup) {
        console.log("[startup] Redirecting authenticated user to dashboard");
        router.replace("/(tabs)/dashboard");
      } else if (!hasToken && !inAuthGroup) {
        console.log("[startup] Redirecting unauthenticated user to login");
        router.replace("/(auth)/login");
      }
    } catch (error) {
      console.error("[startup] Navigation redirect failed", error);
      setStartupError("Unable to navigate to the initial screen");
    }
  }, [isLoading, token, segments]);

  if (startupError) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <StatusBar style="dark" backgroundColor={Colors.background} />
        <View style={styles.center}>
          <Text style={styles.fallbackTitle}>Startup issue</Text>
          <Text style={styles.fallbackSubtitle}>{startupError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              void bootstrapAuth();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        {!isExpoGo ? <PushNotificationsBootstrap /> : null}
        <StatusBar style="dark" backgroundColor={Colors.background} />
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {!isExpoGo ? <PushNotificationsBootstrap /> : null}
      <StatusBar style="dark" backgroundColor={Colors.background} />
      <View style={styles.screen}>
        <AppErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
        </AppErrorBoundary>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },
  fallbackSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
