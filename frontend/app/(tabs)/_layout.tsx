import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { ScreenUI } from "../../constants/ui";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: ScreenUI.card,
          borderTopColor: ScreenUI.border,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: ScreenUI.shadowColor,
          shadowOffset: ScreenUI.shadowOffset,
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarActiveTintColor: ScreenUI.primary,
        tabBarInactiveTintColor: ScreenUI.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-complaints"
        options={{
          title: "My Complaints",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="bell-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="rss" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-circle-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
