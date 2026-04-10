import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenUI } from "../constants/ui";
import { getNotifications, type NotificationItem } from "../services/api";

type FilterTab = "all" | "updates" | "actions" | "archive";

type NotificationDisplay = NotificationItem & {
  title: string;
  message: string;
  timeLabel: string;
  icon: string;
  highlighted: boolean;
};

const UI = {
  background: ScreenUI.background,
  primary: ScreenUI.primary,
  border: ScreenUI.border,
  card: ScreenUI.card,
  impactRadius: ScreenUI.impactRadius,
  radius: ScreenUI.radius,
  textPrimary: ScreenUI.textPrimary,
  textSecondary: ScreenUI.textSecondary,
};

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [notifications, setNotifications] = useState<NotificationDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await getNotifications<NotificationItem[]>();

      const normalized = data.slice(0, 30).map((item) => {
        const status = String(item.status ?? "info").toLowerCase();
        const category = String(item.category ?? "");
        const department = String(item.department ?? "");

        const createdAt = String(item.createdAt ?? "").trim();
        const date = createdAt ? new Date(createdAt) : null;
        const now = Date.now();
        const diffMs = date ? now - date.getTime() : NaN;
        const diffMinutes = Number.isFinite(diffMs)
          ? Math.max(0, Math.floor(diffMs / 60000))
          : NaN;

        const timeLabel = Number.isFinite(diffMinutes)
          ? diffMinutes < 1
            ? "JUST NOW"
            : diffMinutes < 60
              ? `${diffMinutes}M AGO`
              : diffMinutes < 1440
                ? `${Math.floor(diffMinutes / 60)}H AGO`
                : `${Math.floor(diffMinutes / 1440)}D AGO`
          : "RECENT";

        const icon =
          status === "resolved"
            ? "clipboard-check"
            : status === "in_progress"
              ? "progress-clock"
              : status === "pending"
                ? "clock-outline"
                : "bell-outline";

        const title = category || department || "Status Updated";

        const message = item.description
          ? String(item.description)
          : `${title}${department && department !== title ? ` • ${department}` : ""}`;

        const isUnread = item.read !== true;

        return {
          ...item,
          title,
          message,
          timeLabel,
          icon,
          highlighted: isUnread,
          read: item.read ?? false,
        };
      });

      setNotifications(normalized);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load notifications";
      setError(message.replace(/^getNotifications failed: /, ""));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    if (activeTab === "archive") return notifications.filter((n) => n.read);
    if (activeTab === "updates") return notifications.slice(0, 3);
    return notifications.slice(3);
  }, [activeTab, notifications]);

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <MaterialCommunityIcons name="gavel" size={20} color={UI.primary} />
          <Text style={styles.brandText}>Voice2Gov</Text>
        </View>

        <View style={styles.avatarWrap}>
          <MaterialCommunityIcons
            name="account-tie"
            size={24}
            color={UI.primary}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.kicker}>Updates Center</Text>

          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Notifications</Text>
            <TouchableOpacity onPress={handleMarkAllAsRead}>
              <Text style={styles.markAll}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All"
            active={activeTab === "all"}
            onPress={() => setActiveTab("all")}
          />
          <Chip
            label="Updates"
            active={activeTab === "updates"}
            onPress={() => setActiveTab("updates")}
          />
          <Chip
            label="Actions"
            active={activeTab === "actions"}
            onPress={() => setActiveTab("actions")}
          />
          <Chip
            label="Archive"
            active={activeTab === "archive"}
            onPress={() => setActiveTab("archive")}
          />
        </ScrollView>

        {isLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={UI.primary} />
          </View>
        ) : error ? (
          <View style={styles.stateWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredNotifications.map((item, index) => (
              <NotificationCard
                key={
                  item.id
                    ? String(item.id)
                    : item._id
                      ? String(item._id)
                      : item.createdAt
                        ? `${String(item.createdAt)}-${index}`
                        : String(index)
                }
                item={item}
              />
            ))}
          </View>
        )}

        <View style={[styles.impactCard, styles.softShadow]}>
          <View style={styles.impactGlow} />
          <View style={styles.impactHead}>
            <MaterialCommunityIcons
              name="star-four-points"
              size={18}
              color="#C9DAF5"
            />
            <Text style={styles.impactKicker}>Weekly Impact</Text>
          </View>

          <Text style={styles.impactTitle}>You made an impact.</Text>
          <Text style={styles.impactDescription}>
            This week, your reported issues influenced decisions affecting over
            2,400 residents in your district.
          </Text>

          <View style={styles.impactStatsRow}>
            <View style={styles.impactStatBox}>
              <Text style={styles.impactStatValue}>12</Text>
              <Text style={styles.impactStatLabel}>Points</Text>
            </View>
            <View style={styles.impactStatBox}>
              <Text style={styles.impactStatValue}>84%</Text>
              <Text style={styles.impactStatLabel}>Response</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function NotificationCard({ item }: { item: NotificationDisplay }) {
  return (
    <View
      style={[
        styles.notificationCard,
        item.highlighted
          ? styles.notificationCardTint
          : styles.notificationCardPlain,
      ]}
    >
      {item.highlighted ? <View style={styles.leftAccent} /> : null}

      <View style={styles.iconBox}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={24}
          color={item.highlighted ? UI.primary : "#717985"}
        />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.highlighted ? (
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{item.timeLabel}</Text>
            </View>
          ) : (
            <Text style={styles.timeText}>{item.timeLabel}</Text>
          )}
        </View>

        <Text style={styles.cardMessage}>{item.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: UI.background,
  },

  softShadow: {
    shadowColor: ScreenUI.shadowColor,
    shadowOpacity: ScreenUI.shadowOpacity,
    shadowRadius: ScreenUI.shadowRadius,
    shadowOffset: ScreenUI.shadowOffset,
    elevation: ScreenUI.elevation,
  },

  header: {
    height: ScreenUI.headerHeight,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    paddingHorizontal: ScreenUI.headerPaddingHorizontal,
    paddingVertical: ScreenUI.headerPaddingVertical,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandText: {
    fontSize: 18,
    fontWeight: "800",
    color: UI.primary,
    letterSpacing: -0.2,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CBD2DC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  scrollContent: {
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    paddingTop: ScreenUI.pagePaddingTop,
    paddingBottom: 32,
  },

  pageHeader: {
    marginBottom: 10,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: UI.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: ScreenUI.pageTitleSize,
    fontWeight: "800",
    color: UI.primary,
    letterSpacing: -0.3,
  },
  markAll: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.primary,
  },

  chipRow: {
    gap: 10,
    paddingBottom: 10,
    marginBottom: 8,
  },
  chip: {
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  chipActive: {
    backgroundColor: UI.primary,
    borderColor: UI.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.primary,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },

  listWrap: {
    gap: 12,
    marginBottom: 16,
  },

  notificationCard: {
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  notificationCardTint: {
    backgroundColor: "#EEF4FF",
  },
  notificationCardPlain: {
    backgroundColor: "#FFFFFF",
  },
  leftAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: UI.primary,
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: UI.radius,
    backgroundColor: "#F1F5FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#DEE5EF",
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: UI.primary,
    flex: 1,
  },
  timeBadge: {
    height: 26,
    borderRadius: 999,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#DEE5EF",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0E3772",
    textTransform: "uppercase",
  },
  timeText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#5F6570",
    textTransform: "uppercase",
  },
  cardMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: UI.textSecondary,
    fontWeight: "500",
  },

  impactCard: {
    borderRadius: UI.impactRadius,
    backgroundColor: UI.primary,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 18,
    overflow: "hidden",
  },
  impactGlow: {
    position: "absolute",
    top: -48,
    right: -36,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  impactHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  impactKicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#D1E0F7",
    letterSpacing: 1,
  },
  impactTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  impactDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: "#E0EBFA",
    fontWeight: "500",
    marginBottom: 16,
  },
  impactStatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  impactStatBox: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  impactStatValue: {
    fontSize: 46,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  impactStatLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#D7E6FC",
    textTransform: "uppercase",
  },

  stateWrap: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "600",
  },
});
