import { MaterialCommunityIcons } from "@expo/vector-icons";

import { type Href, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/authStore";

import { ScreenUI } from "../../constants/ui";

const DEFAULT_AVATAR_URL =
  "https://ui-avatars.com/api/?name=User&background=1C4980&color=fff";

const UI = {
  background: ScreenUI.background,
  card: ScreenUI.card,
  border: ScreenUI.border,
  primary: ScreenUI.primary,
  textPrimary: ScreenUI.textPrimary,
  textSecondary: ScreenUI.textSecondary,
  labelGray: ScreenUI.labelGray,
  radiusMd: ScreenUI.radiusMd,
  radiusLg: ScreenUI.radiusLg,
};

export default function ProfileScreen() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const user = useAuthStore((state) => state.user);
  const fullName = user?.name || user?.fullName || "Citizen User";
  const email = user?.email || "user@example.com";
  const phone = user?.phone || "Not provided";
  const avatarUrl =
    typeof user?.avatarUrl === "string" && user.avatarUrl.trim().length > 0
      ? user.avatarUrl
      : DEFAULT_AVATAR_URL;

  const initials = useMemo(() => {
    const parts = fullName
      .split(" ")
      .filter((part: string) => part.trim().length > 0)
      .slice(0, 2);

    if (parts.length === 0) {
      return "CU";
    }

    return parts.map((part: string) => part[0]?.toUpperCase() ?? "").join("");
  }, [fullName]);

  const handleLogout = () => {
    if (isLoggingOut) {
      return;
    }

    Alert.alert("Logout", "Do you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsLoggingOut(true);
            try {
              await useAuthStore.getState().logout();
              Alert.alert(
                "Logged Out",
                "You have been logged out successfully.",
                [
                  {
                    text: "OK",
                    onPress: () => router.replace("/(auth)/login" as Href),
                  },
                ],
              );
            } catch {
              Alert.alert(
                "Logout Failed",
                "Unable to logout right now. Please try again.",
              );
            } finally {
              setIsLoggingOut(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.wrapper}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={[styles.headerAvatar, styles.softShadow]}>
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.profileCard, styles.softShadow]}>
            <View style={styles.profileAvatarWrap}>
              <Image
                source={{ uri: avatarUrl }}
                style={styles.profileAvatarImage}
              />
            </View>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
            <View style={styles.initialsBadge}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          </View>

          <View style={[styles.infoCard, styles.softShadow]}>
            <Text style={styles.sectionTitle}>Information</Text>
            <InfoRow label="Full Name" value={fullName} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Phone" value={phone} isLast />
          </View>

          <View style={[styles.actionsCard, styles.softShadow]}>
            <Text style={styles.sectionTitle}>Actions</Text>

            <ActionButton
              icon="account-edit-outline"
              label="Edit Profile"
              isDisabled
              showChevron={false}
            />
            <ActionButton
              icon="lock-reset"
              label="Change Password"
              onPress={() => router.push("/change-password" as Href)}
            />
            <ActionButton
              icon="logout"
              label={isLoggingOut ? "Logging Out..." : "Logout"}
              isDestructive
              isDisabled={isLoggingOut}
              showChevron={!isLoggingOut}
              onPress={handleLogout}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  isDestructive = false,
  isDisabled = false,
  showChevron = true,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  isDestructive?: boolean;
  isDisabled?: boolean;
  showChevron?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        isDestructive && styles.actionButtonDestructive,
        isDisabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled || !onPress}
      activeOpacity={0.9}
    >
      <View style={styles.actionLeft}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={
            isDisabled
              ? UI.textSecondary
              : isDestructive
                ? "#B42318"
                : UI.primary
          }
        />
        <Text
          style={[
            styles.actionLabel,
            isDestructive && styles.actionLabelDestructive,
            isDisabled && styles.actionLabelDisabled,
          ]}
        >
          {label}
        </Text>
      </View>
      {showChevron ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={isDestructive ? "#B42318" : UI.textSecondary}
        />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: UI.background,
  },
  wrapper: {
    flex: 1,
    backgroundColor: UI.background,
  },
  softShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    height: ScreenUI.headerHeight,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: UI.primary,
    letterSpacing: -0.3,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },
  profileCard: {
    backgroundColor: UI.card,
    borderRadius: UI.radiusLg,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 20,
    alignItems: "center",
    position: "relative",
  },
  profileAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#DCE4EF",
    marginBottom: 12,
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: UI.primary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    fontWeight: "500",
    color: UI.textSecondary,
  },
  initialsBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "#EBF3FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  initialsText: {
    fontSize: 10,
    fontWeight: "800",
    color: UI.primary,
    letterSpacing: 0.4,
  },
  infoCard: {
    backgroundColor: UI.card,
    borderRadius: UI.radiusMd,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: UI.primary,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5FA",
    gap: 4,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: UI.labelGray,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: UI.textPrimary,
  },
  actionsCard: {
    backgroundColor: UI.card,
    borderRadius: UI.radiusMd,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
  },
  actionButton: {
    minHeight: 50,
    borderRadius: UI.radiusMd,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  actionButtonDestructive: {
    backgroundColor: "#FFF6F5",
    borderColor: "#FAD7D2",
  },
  actionButtonDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    opacity: 0.75,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: UI.primary,
  },
  actionLabelDestructive: {
    color: "#B42318",
  },
  actionLabelDisabled: {
    color: UI.textSecondary,
  },
});
