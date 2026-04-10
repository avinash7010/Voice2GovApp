import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useRef, useState } from "react";

import { registerPushToken } from "../services/api";

let cachedPushToken = "";

const isExpoGo = Constants.appOwnership === "expo";
const shouldDisablePushNotifications =
  isExpoGo || Constants.executionEnvironment === "storeClient";

export function getCachedPushToken() {
  return cachedPushToken;
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export function usePushNotifications() {
  const [token, setToken] = useState<string>("");
  const receivedListenerRef = useRef<{ remove: () => void } | null>(null);
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);
  const registeredTokenRef = useRef<string>("");

  useEffect(() => {
    console.log("[startup] Push notification bootstrap started");

    if (shouldDisablePushNotifications) {
      console.info("Notifications disabled in Expo Go");
      return;
    }

    if (!Device.isDevice) {
      return;
    }

    let isMounted = true;

    const configureNotifications = async () => {
      try {
        console.log("[startup] Loading expo-notifications module");
        const notifications = await import("expo-notifications");
        if (!isMounted) {
          return;
        }

        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        const currentStatus = await notifications.getPermissionsAsync();
        let finalStatus = currentStatus.status;

        if (currentStatus.status !== "granted") {
          const requested = await notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }

        if (finalStatus !== "granted") {
          return;
        }

        const projectId = getProjectId();
        if (!projectId) {
          throw new Error(
            "Expo projectId is missing. Configure EAS projectId to get a push token.",
          );
        }

        console.log("[startup] Requesting Expo push token");
        const pushToken = await notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (!isMounted) {
          return;
        }

        setToken(pushToken.data);
        cachedPushToken = pushToken.data;

        if (registeredTokenRef.current !== pushToken.data) {
          try {
            await registerPushToken(pushToken.data);
            registeredTokenRef.current = pushToken.data;
          } catch {
            // Intentionally ignore token registration errors to avoid blocking app boot.
          }
        }

        console.log("[startup] Push notification bootstrap completed");

        receivedListenerRef.current =
          notifications.addNotificationReceivedListener(() => {
            // Notification handling is intentionally silent in production.
          });

        responseListenerRef.current =
          notifications.addNotificationResponseReceivedListener(() => {
            // Add deep-link handling here if needed.
          });
      } catch (error) {
        console.warn("[startup] Push notification bootstrap failed", error);
        // Keep app functional even if notifications cannot be configured.
      }
    };

    void configureNotifications();

    return () => {
      isMounted = false;
      receivedListenerRef.current?.remove();
      responseListenerRef.current?.remove();
      receivedListenerRef.current = null;
      responseListenerRef.current = null;
    };
  }, []);

  return token;
}
