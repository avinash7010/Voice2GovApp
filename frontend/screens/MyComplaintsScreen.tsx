import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Colors } from "../constants/theme";
import {
    getComplaintsPage,
    onComplaintCreated,
    type ComplaintListItem,
} from "../services/api";
import { useComplaintsStore } from "../store/complaintsStore";

type FilterType = "all" | "pending" | "resolved" | "in_progress";
type LoadMode = "replace" | "append";

interface Complaint extends ComplaintListItem {
  issueId: string;
}

const PAGE_LIMIT = 12;

const UI = {
  background: "#F2F5F9",
  primary: "#1C4980",
  border: "#E5E7EB",
  radius: 12,
  textPrimary: "#1C1C1C",
  textSecondary: "#434750",
  green: "#00A962",
  orange: "#FF8C00",
  red: "#E11900",
  chipGreenBg: "#E6F6EF",
  chipOrangeBg: "#FFF4E6",
  chipBlueBg: "#EBF2FA",
  chipRedBg: "#FFEBE6",
};

const FILTERS: FilterType[] = ["all", "pending", "resolved", "in_progress"];

function toComplaint(item: ComplaintListItem): Complaint {
  return {
    ...item,
    issueId: `#${item.id.slice(-6).toUpperCase()}`,
  };
}

const ComplaintCard = React.memo(function ComplaintCard({
  complaint,
  onPress,
}: {
  complaint: Complaint;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUri =
    !imageFailed &&
    typeof complaint.imageUrl === "string" &&
    complaint.imageUrl.trim().length > 0
      ? complaint.imageUrl
      : null;

  const statusStyles =
    complaint.status === "resolved"
      ? { bg: UI.chipGreenBg, text: UI.green }
      : complaint.status === "pending"
        ? { bg: UI.chipOrangeBg, text: UI.orange }
        : complaint.status === "in_progress"
          ? { bg: UI.chipBlueBg, text: UI.primary }
          : { bg: UI.chipBlueBg, text: UI.textSecondary };

  const priorityValue = String(complaint.priority ?? "Normal");
  const priorityStyles =
    priorityValue.toLowerCase() === "high"
      ? { bg: UI.chipOrangeBg, text: UI.orange }
      : priorityValue.toLowerCase() === "urgent"
        ? { bg: UI.chipRedBg, text: UI.red }
        : { bg: "#EFF1F4", text: UI.textSecondary };

  return (
    <TouchableOpacity
      style={[styles.complaintCard, styles.softShadow]}
      onPress={onPress}
    >
      <View style={styles.badgesRow}>
        <View style={[styles.badge, { backgroundColor: statusStyles.bg }]}>
          <Text style={[styles.badgeText, { color: statusStyles.text }]}>
            {complaint.status.replace("_", " ")}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: priorityStyles.bg }]}>
          <Text style={[styles.badgeText, { color: priorityStyles.text }]}>
            {priorityValue}
          </Text>
        </View>
        <Text style={styles.issueId}>ID: {complaint.issueId}</Text>
      </View>

      <Text style={styles.complaintTitle}>{complaint.title}</Text>

      <View style={styles.complaintFooter}>
        <View style={styles.metaGroup}>
          <View style={styles.complaintMeta}>
            <MaterialCommunityIcons
              name="tag-outline"
              size={16}
              color={UI.textSecondary}
            />
            <Text style={styles.metaText}>{complaint.category}</Text>
          </View>
          <View style={styles.complaintMeta}>
            <MaterialCommunityIcons
              name="office-building-outline"
              size={16}
              color={UI.textSecondary}
            />
            <Text style={styles.metaText}>
              {String(complaint.department ?? "General")}
            </Text>
          </View>
        </View>
        <View style={styles.trailingSection}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.previewFallback}>
              <MaterialCommunityIcons
                name="image-off-outline"
                size={14}
                color={UI.textSecondary}
              />
            </View>
          )}
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#C5CBD3"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function MyComplaintsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const complaintItems = useComplaintsStore((state) => state.complaints);
  const setComplaints = useComplaintsStore((state) => state.setComplaints);
  const prependComplaint = useComplaintsStore(
    (state) => state.prependComplaint,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const complaints = useMemo(
    () => complaintItems.map(toComplaint),
    [complaintItems],
  );

  const filteredComplaints = useMemo(
    () => complaints.filter((c) => filter === "all" || c.status === filter),
    [complaints, filter],
  );

  const loadComplaints = useCallback(
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
      void loadComplaints(1, "replace");
    }, [loadComplaints]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadComplaints(1, "replace");
  }, [loadComplaints]);

  const onEndReached = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) {
      return;
    }

    void loadComplaints(page + 1, "append");
  }, [hasMore, isLoading, isLoadingMore, loadComplaints, page]);

  const handleComplaintPress = useCallback(
    (complaint: Complaint) => {
      void Haptics.selectionAsync();
      router.push(`/complaint/${complaint.id}` as Href);
    },
    [router],
  );

  const pendingCount = useMemo(
    () => complaints.filter((item) => item.status === "pending").length,
    [complaints],
  );
  const resolvedCount = useMemo(
    () => complaints.filter((item) => item.status === "resolved").length,
    [complaints],
  );

  useEffect(() => {
    const unsubscribe = onComplaintCreated((complaint) => {
      prependComplaint(complaint);
    });

    return unsubscribe;
  }, [prependComplaint]);

  if (isLoading && complaints.length === 0) {
    return (
      <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
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
    <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
      <FlatList
        data={filteredComplaints}
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
                    uri: "https://ui-avatars.com/api/?name=User&background=1C4980&color=fff",
                  }}
                  style={styles.avatarImage}
                />
              </View>
            </View>

            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>My Complaints</Text>
              <Text style={styles.pageSubtitle}>
                Track and manage your civic requests for local improvement.
              </Text>
            </View>

            <View style={[styles.impactCard, styles.softShadow]}>
              <View>
                <Text style={styles.impactLabel}>Total Filed</Text>
                <Text style={styles.impactValue}>{complaints.length}</Text>
                <Text style={styles.impactSubtext}>
                  {resolvedCount} resolved, {pendingCount} pending
                </Text>
              </View>
              <View style={styles.impactIcon}>
                <MaterialCommunityIcons
                  name="clipboard-check-outline"
                  size={24}
                  color={UI.primary}
                />
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {FILTERS.map((item, index) => (
                <TouchableOpacity
                  key={`${item}-${index}`}
                  style={[
                    styles.filterChip,
                    filter === item && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setFilter(item);
                  }}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === item && styles.filterTextActive,
                    ]}
                  >
                    {item.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {error ? (
              <View style={styles.errorCard}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={24}
                  color={UI.red}
                />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.errorRetryButton}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void loadComplaints(1, "replace");
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
            <ComplaintCard
              complaint={item}
              onPress={() => handleComplaintPress(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              iconName="clipboard-alert-outline"
              title={
                filter !== "all"
                  ? "No complaints in this status"
                  : "No complaints yet"
              }
              description={
                filter !== "all"
                  ? `Try another filter or file a new complaint.`
                  : "Create your first complaint and track progress here."
              }
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
        <MaterialCommunityIcons name="plus" size={30} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
  softShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  header: {
    height: 64,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    borderColor: UI.border,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  pageHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: UI.primary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "500",
    lineHeight: 19,
    maxWidth: 330,
  },
  impactCard: {
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  impactLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B6F76",
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  impactValue: {
    fontSize: 30,
    fontWeight: "900",
    color: UI.primary,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  impactSubtext: {
    fontSize: 10,
    fontWeight: "500",
    color: UI.green,
  },
  impactIcon: {
    width: 56,
    height: 56,
    borderRadius: UI.radius,
    backgroundColor: UI.chipBlueBg,
    justifyContent: "center",
    alignItems: "center",
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: UI.primary,
    borderColor: UI.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.textSecondary,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  complaintCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 14,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  issueId: {
    marginLeft: "auto",
    fontSize: 11,
    color: UI.textSecondary,
    fontWeight: "700",
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: UI.textPrimary,
    marginBottom: 10,
  },
  complaintFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trailingSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewImage: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  previewFallback: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EFF1F4",
    alignItems: "center",
    justifyContent: "center",
  },
  metaGroup: {
    gap: 4,
  },
  complaintMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "600",
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  loadingContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  loadingTitleSkeleton: {
    height: 26,
    width: "54%",
    borderRadius: 10,
  },
  loadingSubtitleSkeleton: {
    height: 14,
    width: "72%",
    borderRadius: 8,
    marginBottom: 4,
  },
  loadingCardSkeleton: {
    height: 116,
    width: "100%",
    borderRadius: 14,
  },
  errorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FAD7D2",
    backgroundColor: "#FFF6F5",
    borderRadius: UI.radius,
    padding: 12,
    gap: 6,
  },
  errorText: {
    color: UI.red,
    fontWeight: "600",
    fontSize: 12,
  },
  errorRetryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.red,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  errorRetryText: {
    color: UI.red,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "800",
    color: UI.textPrimary,
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: UI.textSecondary,
    textAlign: "center",
  },
  loadingMoreWrap: {
    paddingVertical: 16,
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
