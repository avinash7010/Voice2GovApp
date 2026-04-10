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
import { ScreenUI } from "../constants/ui";
import {
    getFeedPage,
    normalizeMediaUrl,
    onComplaintCreated,
    type FeedItem as ApiFeedItem,
} from "../services/api";
import { useComplaintsStore } from "../store/complaintsStore";

type FeedTab = "recent" | "trending" | "my_area" | "resolved";
type LoadMode = "replace" | "append";
const PAGE_LIMIT = 10;

interface FeedItem extends ApiFeedItem {
  description: string;
  image: string;
  locationLabel: string;
  statusBadge?: string;
  createdAtLabel?: string;
}

const UI = {
  background: ScreenUI.background,
  primary: ScreenUI.primary,
  border: ScreenUI.border,
  card: ScreenUI.card,
  radius: ScreenUI.radius,
  textPrimary: ScreenUI.textPrimary,
  textSecondary: ScreenUI.textSecondary,
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1515169067868-5387ec356754?w=1400&q=80&auto=format&fit=crop";

function formatCreatedAtLabel(createdAt?: string): string {
  if (!createdAt) {
    return "Recently";
  }

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return "Recently";
  }

  const diffMs = Date.now() - createdDate.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return createdDate.toLocaleDateString();
}

function getLocationLabel(location: unknown): string {
  if (typeof location === "string" && location.trim().length > 0) {
    return location;
  }

  if (location && typeof location === "object") {
    const locationObject = location as {
      address?: unknown;
      lat?: unknown;
      lng?: unknown;
      latitude?: unknown;
      longitude?: unknown;
    };

    if (
      typeof locationObject.address === "string" &&
      locationObject.address.trim().length > 0
    ) {
      return locationObject.address;
    }

    const lat =
      typeof locationObject.lat === "number"
        ? locationObject.lat
        : typeof locationObject.latitude === "number"
          ? locationObject.latitude
          : undefined;
    const lng =
      typeof locationObject.lng === "number"
        ? locationObject.lng
        : typeof locationObject.longitude === "number"
          ? locationObject.longitude
          : undefined;

    if (lat !== undefined && lng !== undefined) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  return "Location unavailable";
}

function toFeedItem(item: ApiFeedItem): FeedItem {
  const rawImageUrl =
    item.imageUrl ??
    (item as { image_url?: unknown }).image_url ??
    (item as { image?: unknown }).image;
  const normalizedImageUrl = normalizeMediaUrl(rawImageUrl) ?? "";

  return {
    ...item,
    description: typeof item.description === "string" ? item.description : "",
    image:
      normalizedImageUrl.trim().length > 0
        ? normalizedImageUrl
        : FALLBACK_IMAGE,
    locationLabel: getLocationLabel(item.location),
    statusBadge:
      item.status === "in_progress"
        ? "Reviewing"
        : item.status === "resolved"
          ? "Resolved"
          : undefined,
    createdAtLabel: formatCreatedAtLabel(item.createdAt),
    votes: Number(item.votes ?? 0),
    comments: Number(item.comments ?? 0),
  };
}

const FeedCard = React.memo(function FeedCard({
  item,
  liked,
  onLike,
  onReadMore,
}: {
  item: FeedItem;
  liked: boolean;
  onLike: () => void;
  onReadMore: () => void;
}) {
  const [displayImage, setDisplayImage] = useState(item.image);

  useEffect(() => {
    setDisplayImage(item.image);
  }, [item.image]);

  const onImageError = useCallback(() => {
    if (displayImage && displayImage !== FALLBACK_IMAGE) {
      setDisplayImage(FALLBACK_IMAGE);
      return;
    }
    setDisplayImage("");
  }, [displayImage]);

  return (
    <View style={[styles.feedCard, styles.softShadow]}>
      <View style={styles.imageWrap}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={styles.feedImage}
            onError={onImageError}
          />
        ) : (
          <View style={styles.feedImageFallback}>
            <MaterialCommunityIcons
              name="image-off-outline"
              size={26}
              color={UI.textSecondary}
            />
            <Text style={styles.feedImageFallbackText}>No image available</Text>
          </View>
        )}

        <View style={styles.locationBadge}>
          <MaterialCommunityIcons
            name="map-marker"
            size={12}
            color={UI.primary}
          />
          <Text style={styles.locationBadgeText}>{item.locationLabel}</Text>
        </View>

        {item.statusBadge ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{item.statusBadge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {item.createdAtLabel ? (
          <Text style={styles.timestampText}>{item.createdAtLabel}</Text>
        ) : null}

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <View style={styles.metricsRow}>
            <TouchableOpacity
              style={styles.metricItem}
              onPress={() => {
                void Haptics.selectionAsync();
                onLike();
              }}
            >
              <MaterialCommunityIcons
                name={liked ? "thumb-up" : "thumb-up-outline"}
                size={18}
                color={UI.textPrimary}
              />
              <Text style={styles.metricText}>{item.votes ?? 0}</Text>
            </TouchableOpacity>

            <View style={styles.metricItem}>
              <MaterialCommunityIcons
                name="comment"
                size={16}
                color={UI.textPrimary}
              />
              <Text style={styles.metricText}>{item.comments ?? 0}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.upvoteButton}
            onPress={() => {
              void Haptics.selectionAsync();
              onReadMore();
            }}
          >
            <Text style={styles.upvoteText}>Open</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function PublicFeedScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FeedTab>("recent");
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({});
  const feedItems = useComplaintsStore((state) => state.feedItems);
  const setFeedItems = useComplaintsStore((state) => state.setFeedItems);
  const prependComplaint = useComplaintsStore(
    (state) => state.prependComplaint,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const loadFeed = useCallback(
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

        const response = await getFeedPage({
          page: nextPage,
          limit: PAGE_LIMIT,
        });
        const mapped = response.items.map(toFeedItem);

        setFeedItems(mapped, mode);
        setHasMore(response.hasMore);
        setPage(nextPage);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load feed";
        setError(message.replace(/^API request failed: /, ""));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [isRefreshing, setFeedItems],
  );

  useFocusEffect(
    useCallback(() => {
      void loadFeed(1, "replace");
    }, [loadFeed]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadFeed(1, "replace");
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) {
      return;
    }

    void loadFeed(page + 1, "append");
  }, [hasMore, isLoading, isLoadingMore, loadFeed, page]);

  const items = useMemo(() => feedItems.map(toFeedItem), [feedItems]);

  const filteredItems = useMemo(() => {
    if (activeTab === "resolved") {
      return items.filter((item) => item.status === "resolved");
    }
    if (activeTab === "my_area") {
      return items.filter((item) => item.locationLabel.includes("District"));
    }
    if (activeTab === "trending") {
      return [...items].sort(
        (a, b) => Number(b.votes ?? 0) - Number(a.votes ?? 0),
      );
    }
    return items;
  }, [activeTab, items]);

  const handleLike = useCallback((id: string) => {
    setLikedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  useEffect(() => {
    const unsubscribe = onComplaintCreated((complaint) => {
      prependComplaint(complaint);
    });

    return unsubscribe;
  }, [prependComplaint]);

  if (isLoading && items.length === 0) {
    return (
      <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
        <View style={styles.loadingContent}>
          <Skeleton style={styles.loadingTitleSkeleton} />
          <Skeleton style={styles.loadingSubtitleSkeleton} />
          <Skeleton style={styles.loadingCardSkeleton} />
          <Skeleton style={styles.loadingCardSkeleton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
      <FlatList
        data={filteredItems}
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
              <View style={styles.brandRow}>
                <MaterialCommunityIcons
                  name="gavel"
                  size={20}
                  color={UI.primary}
                />
                <Text style={styles.brandText}>Voice2Gov</Text>
              </View>
              <View style={styles.avatarWrap}>
                <Image
                  source={{
                    uri: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&q=80&auto=format&fit=crop",
                  }}
                  style={styles.avatarImage}
                />
              </View>
            </View>

            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>Community Feed</Text>
              <Text style={styles.pageSubtitle}>
                Real-time civic updates for your district
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {(["recent", "trending", "my_area", "resolved"] as FeedTab[]).map(
                (item, index) => (
                  <TouchableOpacity
                    key={`${item}-${index}`}
                    style={[
                      styles.filterChip,
                      activeTab === item && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setActiveTab(item);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        activeTab === item && styles.filterTextActive,
                      ]}
                    >
                      {item.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>

            {error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.errorRetryButton}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void loadFeed(1, "replace");
                  }}
                >
                  <Text style={styles.errorRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item, index }) => (
          <View style={styles.rowWrap}>
            <FeedCard
              item={item}
              liked={Boolean(likedItems[item.id])}
              onLike={() => handleLike(item.id)}
              onReadMore={() => router.push(`/complaint/${item.id}` as Href)}
            />
            {index === 0 ? (
              <View style={styles.impactCard}>
                <View style={styles.impactLeft}>
                  <Text style={styles.impactLabel}>Community Impact</Text>
                  <Text style={styles.impactMessage}>
                    Your voice is driving faster responses this month.
                  </Text>
                </View>
                <View style={styles.progressWrap}>
                  <View style={styles.progressRing}>
                    <Text style={styles.progressText}>Live</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              iconName="newspaper-variant-outline"
              title="No feed items yet"
              description="Be the first to submit a complaint and start community momentum."
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
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
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
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    marginBottom: 12,
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
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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
    borderColor: "#D1D5DB",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  pageHeader: {
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: ScreenUI.pageTitleSize,
    fontWeight: "800",
    color: UI.primary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "500",
    lineHeight: 19,
  },
  chipRow: {
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    paddingBottom: 10,
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
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
    color: UI.primary,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  errorWrap: {
    marginHorizontal: ScreenUI.pagePaddingHorizontal,
    borderWidth: 1,
    borderColor: "#FAD7D2",
    backgroundColor: "#FFF6F5",
    borderRadius: ScreenUI.radius,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "600",
  },
  errorRetryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#B42318",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  errorRetryText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "700",
  },
  stateWrap: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  loadingTitleSkeleton: {
    height: 26,
    width: "62%",
    borderRadius: 10,
  },
  loadingSubtitleSkeleton: {
    height: 14,
    width: "74%",
    borderRadius: 8,
    marginBottom: 4,
  },
  loadingCardSkeleton: {
    height: 230,
    width: "100%",
    borderRadius: 14,
  },
  emptyText: {
    color: UI.textSecondary,
    fontWeight: "600",
  },
  feedCard: {
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    overflow: "hidden",
  },
  imageWrap: {
    height: 170,
    backgroundColor: "#D6E2F4",
  },
  feedImage: {
    width: "100%",
    height: "100%",
  },
  feedImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#E5EAF2",
  },
  feedImageFallbackText: {
    fontSize: 12,
    color: UI.textSecondary,
    fontWeight: "600",
  },
  locationBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "80%",
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: UI.primary,
  },
  statusBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "rgba(28,73,128,0.9)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  cardBody: {
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: UI.textPrimary,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: UI.textSecondary,
  },
  timestampText: {
    fontSize: 11,
    color: UI.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardDivider: {
    height: 1,
    backgroundColor: UI.border,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricText: {
    fontSize: 12,
    color: UI.textPrimary,
    fontWeight: "700",
  },
  upvoteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upvoteText: {
    color: UI.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  impactCard: {
    marginTop: 10,
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#FFFFFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  impactLeft: {
    flex: 1,
    paddingRight: 12,
  },
  impactLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: UI.textSecondary,
    fontWeight: "700",
    marginBottom: 6,
  },
  impactMessage: {
    fontSize: 12,
    color: UI.textPrimary,
    fontWeight: "600",
    lineHeight: 18,
  },
  progressWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    fontSize: 11,
    color: UI.primary,
    fontWeight: "800",
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
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
});
