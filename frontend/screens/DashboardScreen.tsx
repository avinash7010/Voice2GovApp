import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Colors } from "../constants/theme";
import { ScreenUI } from "../constants/ui";
import {
    getComplaintsPage,
    onComplaintCreated,
    type ComplaintListItem,
} from "../services/api";
import { useComplaintsStore } from "../store/complaintsStore";

interface Activity extends ComplaintListItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  reportedTime: string;
  priorityColor: string;
  statusColor: string;
}

type LoadMode = "replace" | "append";
const PAGE_LIMIT = 10;

const UI = {
  primary: ScreenUI.primary,
  background: ScreenUI.background,
  card: ScreenUI.card,
  border: ScreenUI.border,
  accentBlueBg: ScreenUI.chipBlueBg,
  textPrimary: ScreenUI.textPrimary,
  textSecondary: ScreenUI.textSecondary,
  chipGreenText: ScreenUI.chipGreenText,
  radiusMd: ScreenUI.radiusMd,
  radiusLg: ScreenUI.radiusLg,
};

function getCategoryIcon(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes("water")) return "water";
  if (normalized.includes("electric") || normalized.includes("light"))
    return "lightbulb-outline";
  if (normalized.includes("sanitation") || normalized.includes("garbage"))
    return "trash-can";
  if (normalized.includes("road") || normalized.includes("infrastructure"))
    return "road";
  return "alert-circle";
}

function getPriorityColor(priority: string): string {
  const normalized = priority.toLowerCase();
  if (normalized === "high" || normalized === "urgent") return Colors.error;
  if (normalized === "low") return Colors.success;
  return Colors.warning;
}

function getStatusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "pending") return Colors.warning;
  if (normalized === "in_progress") return UI.primary;
  if (normalized === "resolved") return Colors.success;
  return Colors.textSecondary;
}

function getReportedTime(createdAt?: string): string {
  if (!createdAt) return "Recently";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function toActivity(item: ComplaintListItem): Activity {
  return {
    ...item,
    icon: getCategoryIcon(item.category),
    iconBg: UI.accentBlueBg,
    iconColor: UI.primary,
    reportedTime: getReportedTime(item.createdAt),
    priorityColor: getPriorityColor(String(item.priority ?? "medium")),
    statusColor: getStatusColor(item.status),
  };
}

const ActivityCard = React.memo(function ActivityCard({
  activity,
  onPress,
}: {
  activity: Activity;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUri =
    !imageFailed &&
    typeof activity.imageUrl === "string" &&
    activity.imageUrl.trim().length > 0
      ? activity.imageUrl
      : null;

  return (
    <TouchableOpacity
      style={[styles.activityCard, styles.softShadow]}
      onPress={onPress}
    >
      <View style={[styles.activityIcon, { backgroundColor: activity.iconBg }]}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.activityImage}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <MaterialCommunityIcons
            name={activity.icon as never}
            size={24}
            color={activity.iconColor}
          />
        )}
      </View>

      <View style={styles.activityContent}>
        <View style={styles.activityTitleRow}>
          <Text style={styles.activityTitle} numberOfLines={1}>
            {activity.title || "Complaint"}
          </Text>

          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: `${activity.priorityColor}1A` },
            ]}
          >
            <Text
              style={[styles.priorityText, { color: activity.priorityColor }]}
            >
              {activity.category}
            </Text>
          </View>
        </View>

        <Text style={styles.activityMeta}>
          Reported {activity.reportedTime} • {activity.category}
        </Text>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: activity.statusColor },
            ]}
          />
          <Text style={[styles.statusText, { color: activity.statusColor }]}>
            {activity.status.replace("_", " ")}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function DashboardScreen() {
  const router = useRouter();
  const complaints = useComplaintsStore((state) => state.complaints);
  const setComplaints = useComplaintsStore((state) => state.setComplaints);
  const prependComplaint = useComplaintsStore(
    (state) => state.prependComplaint,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const activities = useMemo(() => complaints.map(toActivity), [complaints]);

  const loadActivities = useCallback(
    async (nextPage: number, mode: LoadMode) => {
      if (mode === "replace") {
        setError("");
      }

      try {
        if (mode === "replace" && !isRefreshing) {
          setIsLoading(true);
        }
        if (mode === "append") {
          setIsLoadingMore(true);
        }

        const result = await getComplaintsPage({
          page: nextPage,
          limit: PAGE_LIMIT,
        });

        setComplaints(result.items, mode);
        setHasMore(result.hasMore);
        setPage(nextPage);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load complaints";
        setError(message.replace(/^API request failed: /, ""));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [isRefreshing, setComplaints],
  );

  useFocusEffect(
    useCallback(() => {
      void loadActivities(1, "replace");
    }, [loadActivities]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadActivities(1, "replace");
  }, [loadActivities]);

  const onEndReached = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) {
      return;
    }

    void loadActivities(page + 1, "append");
  }, [hasMore, isLoading, isLoadingMore, loadActivities, page]);

  const totals = useMemo(() => {
    const total = activities.length;
    const pending = activities.filter(
      (item) => item.status === "pending",
    ).length;
    const resolved = activities.filter(
      (item) => item.status === "resolved",
    ).length;
    const civicScore = Math.min(999, total * 12 + resolved * 18);
    return { total, pending, resolved, civicScore };
  }, [activities]);

  const handleOpenDetails = useCallback(
    (id: string) => {
      void Haptics.selectionAsync();
      router.push(`/complaint/${id}` as Href);
    },
    [router],
  );

  useEffect(() => {
    const unsubscribe = onComplaintCreated((complaint) => {
      prependComplaint(complaint);
    });

    return unsubscribe;
  }, [prependComplaint]);

  if (isLoading && activities.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.loadingContent}>
          <Skeleton style={styles.loadingTitleSkeleton} />
          <Skeleton style={styles.loadingSubtitleSkeleton} />
          <Skeleton style={styles.loadingCardSkeleton} />
          <Skeleton style={styles.loadingCardSkeleton} />
          <Skeleton style={styles.loadingCardSkeleton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <FlatList
        data={activities}
        keyExtractor={(item, index) => {
          if (item.id) return String(item.id);
          if (item._id) return String(item._id);
          if (item.createdAt) return `${String(item.createdAt)}-${index}`;
          return String(index);
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons
                  name="gavel"
                  size={20}
                  color={UI.primary}
                />
                <Text style={styles.appTitle}>Voice2Gov</Text>
              </View>
              <View style={[styles.profileAvatar, styles.softShadow]}>
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuD4E-e4xumwaDTxi-Q-qogilKoTVGzxQCHXNb_EMziBGoYfvESf9BlYgd6Gp1Y2Y2Nwu9u3CFTKCnMXlcpOAgbYmIAOStGvMCGdpNveYdO0EWsZaB5r3fVxB_K3jzvd9m9R0vMprY4Z2e0BHvYl52pUa6i-fvFN-ft59MHycWkYwOtU13sxWPsa7YU7eGTamngCYW2p3jSELhb3-emvQeom12NsTTcfL54RJLMvVgfLrgtnPBCxmaq04l5ElIWIiwF05abl8X5Solg",
                  }}
                  style={styles.avatarImage}
                />
              </View>
            </View>

            <View style={styles.greetingSection}>
              <Text style={styles.greeting}>Hello, Citizen</Text>
              <Text style={styles.greetingSubtext}>
                Here is your civic engagement overview
              </Text>
            </View>

            <View style={[styles.civicCard, styles.softShadow]}>
              <View style={styles.civicCardLeftAccent} />
              <View style={styles.civicTop}>
                <View style={styles.civicLeft}>
                  <Text style={styles.civicLabel}>Civic Impact Score</Text>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>{totals.civicScore}</Text>
                    <View style={styles.trendBadge}>
                      <MaterialCommunityIcons
                        name="trending-up"
                        size={12}
                        color={UI.chipGreenText}
                      />
                      <Text style={styles.trendText}>Live</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.civicIcon}>
                  <MaterialCommunityIcons
                    name="chart-line"
                    size={24}
                    color={UI.primary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                label="Total"
                value={String(totals.total)}
                bgColor={UI.accentBlueBg}
              />
              <StatCard
                label="Pending"
                value={String(totals.pending)}
                bgColor={UI.card}
              />
              <StatCard
                label="Resolved"
                value={String(totals.resolved)}
                bgColor={UI.card}
              />
            </View>

            <View style={styles.activityHeader}>
              <Text style={styles.activitySectionTitle}>Recent Activity</Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/my-complaints" as Href)}
              >
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.errorRetryButton}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void loadActivities(1, "replace");
                  }}
                >
                  <Text style={styles.errorRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <ActivityCard
              activity={item}
              onPress={() => handleOpenDetails(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              iconName="clipboard-text-outline"
              title="No complaints yet"
              description="Start by filing your first complaint. You will see live updates here."
              actionTitle="Create Complaint"
              onAction={() => router.push("/create-complaint" as Href)}
            />
          ) : null
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <ActivityIndicator size="small" color={UI.primary} />
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          void Haptics.selectionAsync();
          router.push("/create-complaint" as Href);
        }}
        activeOpacity={0.9}
      >
        <MaterialCommunityIcons name="plus" size={28} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  bgColor,
}: {
  label: string;
  value: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: UI.background,
  },
  listContent: {
    paddingBottom: 110,
  },
  rowWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12,
  },
  loadingTitleSkeleton: {
    height: 26,
    width: "58%",
    borderRadius: 10,
  },
  loadingSubtitleSkeleton: {
    height: 14,
    width: "78%",
    borderRadius: 8,
    marginBottom: 4,
  },
  loadingCardSkeleton: {
    height: 108,
    width: "100%",
    borderRadius: 14,
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
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: UI.primary,
    letterSpacing: -0.2,
  },
  profileAvatar: {
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
  greetingSection: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: UI.primary,
  },
  greetingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "500",
  },
  civicCard: {
    marginHorizontal: 16,
    backgroundColor: UI.card,
    borderRadius: UI.radiusLg,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
  },
  civicCardLeftAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: UI.primary,
  },
  civicTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  civicLeft: {
    flex: 1,
  },
  civicLabel: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: "900",
    color: UI.primary,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ScreenUI.chipGreenBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "700",
    color: UI.chipGreenText,
  },
  civicIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ScreenUI.chipBlueBg,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: UI.radiusMd,
    borderWidth: 1,
    borderColor: UI.border,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "600",
  },
  statValue: {
    marginTop: 4,
    fontSize: 18,
    color: UI.textPrimary,
    fontWeight: "800",
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  activitySectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: UI.textPrimary,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.primary,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FAD7D2",
    backgroundColor: "#FFF6F5",
    borderRadius: ScreenUI.radius,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: Colors.error,
    fontWeight: "600",
    fontSize: 12,
  },
  errorRetryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  errorRetryText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyText: {
    textAlign: "center",
    color: UI.textSecondary,
    fontWeight: "500",
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activityImage: {
    width: "100%",
    height: "100%",
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activityTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: UI.textPrimary,
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  activityMeta: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "500",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  loadingMoreWrap: {
    paddingVertical: 14,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: UI.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
