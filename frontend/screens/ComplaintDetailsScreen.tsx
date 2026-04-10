import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type ImageStyle,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Typography } from "../constants/theme";
import { ScreenUI } from "../constants/ui";
import { getCachedPushToken } from "../hooks/usePushNotifications";
import {
    getComplaintById,
    normalizeMediaUrl,
    submitComplaint as submitComplaintApi,
    type ComplaintDetailResponse,
    type ComplaintPayload,
} from "../services/api";
import {
    clearComplaintDraft,
    getComplaintDraft,
} from "../services/complaintDraft";

type ComplaintDetailsData = ComplaintDetailResponse & {
  address?: string;
  lat?: number;
  lng?: number;
};

type ComplaintViewData = {
  title: string;
  description: string;
  category: string;
  department: string;
  priority: string;
  address: string;
  lat?: number;
  lng?: number;
  imageUrl: string | null;
  isDraft: boolean;
  draftPayload?: ComplaintPayload;
  draftImageUri?: string | null;
};

const DEFAULT_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const UI = {
  background: ScreenUI.background,
  card: ScreenUI.card,
  border: ScreenUI.border,
  textPrimary: ScreenUI.textPrimary,
  textSecondary: ScreenUI.textSecondary,
  label: ScreenUI.labelGray,
  icon: ScreenUI.primary,
};

export default function ComplaintDetailsScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{
    id?: string | string[];
    source?: string | string[];
  }>();

  const complaintId = useMemo(() => {
    if (Array.isArray(id)) {
      return (id[0] ?? "").trim();
    }
    return (id ?? "").trim();
  }, [id]);

  const sourceMode = useMemo(() => {
    if (Array.isArray(source)) {
      return (source[0] ?? "").trim();
    }
    return (source ?? "").trim();
  }, [source]);

  const [complaint, setComplaint] = useState<ComplaintViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [evidenceImageFailed, setEvidenceImageFailed] = useState(false);
  const [resolvedCoordinates, setResolvedCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadComplaint = async () => {
      try {
        setLoading(true);
        setError("");

        if (sourceMode === "draft") {
          const draft = await getComplaintDraft();
          if (!draft) {
            throw new Error(
              "Draft complaint is missing. Please create it again.",
            );
          }

          if (mounted) {
            setComplaint({
              title: draft.payload.title || "Untitled Complaint",
              description: draft.payload.description || "No description",
              category: draft.payload.category || "N/A",
              department: draft.payload.department || "N/A",
              priority: draft.payload.priority || "N/A",
              address: draft.payload.location || "Location unavailable",
              lat: draft.coordinates?.latitude,
              lng: draft.coordinates?.longitude,
              imageUrl: draft.imageUri,
              isDraft: true,
              draftPayload: draft.payload,
              draftImageUri: draft.imageUri,
            });
          }

          return;
        }

        if (!complaintId) {
          throw new Error("Complaint ID is missing");
        }

        const response =
          await getComplaintById<ComplaintDetailResponse>(complaintId);

        const locationObject =
          response.location && typeof response.location === "object"
            ? (response.location as Record<string, unknown>)
            : null;

        const lat =
          typeof response.latitude === "number"
            ? response.latitude
            : typeof locationObject?.lat === "number"
              ? locationObject.lat
              : typeof locationObject?.latitude === "number"
                ? locationObject.latitude
                : undefined;

        const lng =
          typeof response.longitude === "number"
            ? response.longitude
            : typeof locationObject?.lng === "number"
              ? locationObject.lng
              : typeof locationObject?.longitude === "number"
                ? locationObject.longitude
                : undefined;

        const responseAddress = (response as ComplaintDetailsData).address;
        const rawImageUrl =
          response.imageUrl ?? response.image_url ?? response.image;
        const imageUrl = normalizeMediaUrl(rawImageUrl) ?? null;
        const address =
          typeof responseAddress === "string"
            ? responseAddress
            : typeof response.location === "string"
              ? response.location
              : typeof locationObject?.address === "string"
                ? locationObject.address
                : lat !== undefined && lng !== undefined
                  ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "Location unavailable";

        if (mounted) {
          setComplaint({
            title: response.title || "Complaint",
            description: response.description || "No description available",
            category: response.category || "N/A",
            department: response.department || "N/A",
            priority: response.priority || "N/A",
            address,
            lat,
            lng,
            imageUrl,
            isDraft: false,
          });
        }
      } catch (err) {
        if (mounted) {
          const message =
            err instanceof Error
              ? err.message
                  .replace(/^getComplaintById failed: /, "")
                  .replace(/^submitComplaint failed: /, "")
              : "Failed to load complaint details";
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadComplaint();

    return () => {
      mounted = false;
    };
  }, [complaintId, sourceMode]);

  useEffect(() => {
    setEvidenceImageFailed(false);
  }, [complaint?.imageUrl]);

  useEffect(() => {
    let active = true;

    const resolveCoordinatesFromAddress = async () => {
      if (!complaint) {
        if (active) {
          setResolvedCoordinates(null);
          setIsGeocoding(false);
        }
        return;
      }

      if (complaint.lat !== undefined && complaint.lng !== undefined) {
        if (active) {
          setResolvedCoordinates({
            latitude: complaint.lat,
            longitude: complaint.lng,
          });
          setIsGeocoding(false);
        }
        return;
      }

      const address = complaint.address.trim();
      if (
        !address ||
        address.toLowerCase() === "location unavailable" ||
        address.toLowerCase() === "unknown"
      ) {
        if (active) {
          setResolvedCoordinates(null);
          setIsGeocoding(false);
        }
        return;
      }

      if (active) {
        setIsGeocoding(true);
      }

      try {
        const geocoded = await Location.geocodeAsync(address);
        const firstMatch = geocoded[0];

        if (
          active &&
          firstMatch &&
          Number.isFinite(firstMatch.latitude) &&
          Number.isFinite(firstMatch.longitude)
        ) {
          setResolvedCoordinates({
            latitude: firstMatch.latitude,
            longitude: firstMatch.longitude,
          });
          return;
        }
      } catch {
        // Keep fallback UI when geocoding fails.
      } finally {
        if (active) {
          setIsGeocoding(false);
        }
      }

      if (active) {
        setResolvedCoordinates(null);
      }
    };

    void resolveCoordinatesFromAddress();

    return () => {
      active = false;
    };
  }, [complaint]);

  const hasCoordinates = resolvedCoordinates !== null;

  const mapRegion: Region = resolvedCoordinates
    ? {
        latitude: resolvedCoordinates.latitude,
        longitude: resolvedCoordinates.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }
    : DEFAULT_REGION;

  const openExternalMap = async () => {
    const addressQuery = complaint?.address?.trim();

    const query = hasCoordinates
      ? `${resolvedCoordinates.latitude},${resolvedCoordinates.longitude}`
      : addressQuery &&
          addressQuery.toLowerCase() !== "location unavailable" &&
          addressQuery.toLowerCase() !== "unknown"
        ? encodeURIComponent(addressQuery)
        : "";

    if (!query) {
      Alert.alert(
        "Location unavailable",
        "We could not find a valid location.",
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          "Unable to open map",
          "Google Maps URL is not supported on this device.",
        );
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open map", "Please try again in a moment.");
    }
  };

  const openFullScreenMap = () => {
    if (!hasCoordinates) {
      return;
    }

    router.push({
      pathname: "/complaint/map-view",
      params: {
        lat: String(resolvedCoordinates.latitude),
        lng: String(resolvedCoordinates.longitude),
        address: complaint?.address ?? "",
        title: complaint?.title ?? "Complaint Location",
      },
    });
  };

  const onConfirmComplaint = async () => {
    if (!complaint?.isDraft || !complaint.draftPayload || isConfirming) {
      return;
    }

    try {
      setIsConfirming(true);

      const pushToken = getCachedPushToken();
      const payload: ComplaintPayload = {
        ...complaint.draftPayload,
        ...(pushToken ? { push_token: pushToken } : {}),
      };

      await submitComplaintApi(payload, complaint.draftImageUri ?? null);

      await clearComplaintDraft();

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Complaint Submitted",
        "Your complaint is now visible in dashboard, feed, and my complaints.",
        [
          {
            text: "View My Complaints",
            onPress: () => router.replace("/(tabs)/my-complaints"),
          },
        ],
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.replace(/^submitComplaint failed: /, "")
          : "Please try again.";
      Alert.alert("Submission Failed", message || "Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.wrapper}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={26}
              color={UI.textPrimary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Complaint Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={UI.icon} />
          </View>
        ) : error ? (
          <View style={styles.stateWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.stateActionButton}
              onPress={() => router.replace("/(tabs)/dashboard")}
            >
              <Text style={styles.stateActionText}>Go To Dashboard</Text>
            </Pressable>
          </View>
        ) : !complaint ? (
          <View style={styles.stateWrap}>
            <Text style={styles.errorText}>Complaint not found</Text>
            <Pressable
              style={styles.stateActionButton}
              onPress={() => router.replace("/(tabs)/dashboard")}
            >
              <Text style={styles.stateActionText}>Go To Dashboard</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                styles.scrollContentWithFooter,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.heroCard, styles.softShadow]}>
                <View style={styles.heroHeaderRow}>
                  <Text style={styles.heroTitle}>{complaint.title}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      complaint.isDraft
                        ? styles.statusDraft
                        : styles.statusLive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        complaint.isDraft
                          ? styles.statusDraftText
                          : styles.statusLiveText,
                      ]}
                    >
                      {complaint.isDraft
                        ? "Awaiting Confirmation"
                        : "Submitted"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <InfoCard
                  icon="alert-circle-outline"
                  label="PRIORITY"
                  value={complaint.priority}
                />
                <InfoCard
                  icon="folder-outline"
                  label="CATEGORY"
                  value={complaint.category}
                />
                <InfoCard
                  icon="office-building-outline"
                  label="DEPARTMENT"
                  value={complaint.department}
                />
              </View>

              <Text style={styles.sectionTitle}>Description</Text>
              <View style={[styles.card, styles.softShadow]}>
                <Text style={styles.descriptionText}>
                  {complaint.description}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Location</Text>
              <View style={[styles.card, styles.softShadow]}>
                <Text style={styles.addressText}>{complaint.address}</Text>

                {hasCoordinates ? (
                  <Pressable style={styles.mapCard} onPress={openFullScreenMap}>
                    <MapView
                      style={styles.mapView}
                      initialRegion={mapRegion}
                      region={mapRegion}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      toolbarEnabled={false}
                      showsMyLocationButton={false}
                    >
                      <Marker
                        coordinate={{
                          latitude: resolvedCoordinates.latitude,
                          longitude: resolvedCoordinates.longitude,
                        }}
                      />
                    </MapView>

                    <View pointerEvents="none" style={styles.mapOpenHint}>
                      <MaterialCommunityIcons
                        name="arrow-expand-all"
                        size={14}
                        color={Colors.white}
                      />
                      <Text style={styles.mapOpenHintText}>
                        Tap to open full screen map
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.mapFallbackCard}>
                    <MaterialCommunityIcons
                      name="map-search-outline"
                      size={20}
                      color={UI.textSecondary}
                    />
                    <Text style={styles.mapFallbackTitle}>
                      {isGeocoding
                        ? "Locating from address..."
                        : "Location unavailable"}
                    </Text>
                    <Text style={styles.mapFallbackText}>
                      {isGeocoding
                        ? "Trying to find precise coordinates from the complaint address."
                        : "Precise coordinates are missing for this complaint."}
                    </Text>
                    <Pressable
                      style={styles.mapFallbackAction}
                      onPress={() => {
                        void openExternalMap();
                      }}
                    >
                      <Text style={styles.mapFallbackActionText}>
                        Open in Google Maps
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {complaint.imageUrl ? (
                <>
                  <Text style={styles.sectionTitle}>Evidence Image</Text>
                  <View style={[styles.card, styles.softShadow]}>
                    {evidenceImageFailed ? (
                      <View style={styles.evidenceImageFallback}>
                        <MaterialCommunityIcons
                          name="image-off-outline"
                          size={28}
                          color={UI.textSecondary}
                        />
                        <Text style={styles.evidenceImageFallbackText}>
                          Image unavailable
                        </Text>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: complaint.imageUrl }}
                        style={styles.evidenceImage}
                        onError={() => setEvidenceImageFailed(true)}
                      />
                    )}
                  </View>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.footerActionWrap}>
              {complaint.isDraft ? (
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void onConfirmComplaint();
                  }}
                  disabled={isConfirming}
                  style={[
                    styles.confirmButton,
                    isConfirming && styles.confirmButtonDisabled,
                  ]}
                >
                  {isConfirming ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      Submit Complaint
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <View style={styles.footerNavRow}>
                <Pressable
                  style={styles.secondaryFooterButton}
                  onPress={() => router.replace("/(tabs)/my-complaints")}
                >
                  <Text style={styles.secondaryFooterButtonText}>
                    View My Complaints
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.ghostFooterButton}
                  onPress={() => router.replace("/(tabs)/dashboard")}
                >
                  <Text style={styles.ghostFooterButtonText}>
                    Go to Dashboard
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.metaCard, styles.softShadow]}>
      <View style={styles.infoRow}>
        <MaterialCommunityIcons
          name={icon as never}
          size={22}
          color={UI.icon}
        />
        <View style={styles.infoTextWrap}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: UI.background,
  } satisfies ViewStyle,
  wrapper: {
    flex: 1,
    backgroundColor: UI.background,
  } satisfies ViewStyle,
  headerBar: {
    height: ScreenUI.headerHeight,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  } satisfies ViewStyle,
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  headerTitle: {
    fontSize: ScreenUI.pageTitleSize,
    fontWeight: "800",
    color: UI.textPrimary,
  } satisfies TextStyle,
  headerSpacer: {
    width: 36,
    height: 36,
  } satisfies ViewStyle,
  scrollContent: {
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    paddingTop: ScreenUI.pagePaddingTop,
    paddingBottom: ScreenUI.pagePaddingBottom,
    gap: 12,
  } satisfies ViewStyle,
  scrollContentWithFooter: {
    paddingBottom: 188,
  } satisfies ViewStyle,
  card: {
    backgroundColor: UI.card,
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: ScreenUI.cardPadding,
    paddingVertical: ScreenUI.cardPadding,
  } satisfies ViewStyle,
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  } satisfies ViewStyle,
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  } satisfies ViewStyle,
  heroTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: UI.textPrimary,
  } satisfies TextStyle,
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  } satisfies ViewStyle,
  statusDraft: {
    backgroundColor: "#FFF4D5",
    borderColor: "#F2C94C",
  } satisfies ViewStyle,
  statusLive: {
    backgroundColor: "#E9F8EE",
    borderColor: "#7ACF93",
  } satisfies ViewStyle,
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  } satisfies TextStyle,
  statusDraftText: {
    color: "#8A6110",
  } satisfies TextStyle,
  statusLiveText: {
    color: "#1B6B3A",
  } satisfies TextStyle,
  metaGrid: {
    gap: 10,
  } satisfies ViewStyle,
  metaCard: {
    backgroundColor: UI.card,
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: ScreenUI.cardPadding,
    paddingVertical: 12,
  } satisfies ViewStyle,
  softShadow: {
    shadowColor: ScreenUI.shadowColor,
    shadowOpacity: ScreenUI.shadowOpacity,
    shadowRadius: ScreenUI.shadowRadius,
    shadowOffset: ScreenUI.shadowOffset,
    elevation: ScreenUI.elevation,
  } satisfies ViewStyle,
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  } satisfies ViewStyle,
  infoTextWrap: {
    flex: 1,
  } satisfies ViewStyle,
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.label,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  } satisfies TextStyle,
  infoValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: UI.textPrimary,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: ScreenUI.sectionTitleSize,
    fontWeight: "800",
    color: UI.textPrimary,
    marginTop: 6,
    marginBottom: 0,
  } satisfies TextStyle,
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: UI.textPrimary,
    fontWeight: "500",
  } satisfies TextStyle,
  addressText: {
    fontSize: 14,
    lineHeight: 20,
    color: UI.textPrimary,
    marginBottom: 10,
    fontWeight: "500",
  } satisfies TextStyle,
  mapCard: {
    width: "100%",
    height: 188,
    borderRadius: ScreenUI.radius,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#E5E7EB",
  } satisfies ViewStyle,
  mapView: {
    flex: 1,
  } satisfies ViewStyle,
  mapFallbackOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.68)",
  } satisfies ViewStyle,
  mapFallbackText: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.textSecondary,
  } satisfies TextStyle,
  mapOpenHint: {
    position: "absolute",
    right: 10,
    bottom: 10,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.82)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  } satisfies ViewStyle,
  mapOpenHintText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
  } satisfies TextStyle,
  mapFallbackCard: {
    width: "100%",
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "flex-start",
    gap: 8,
  } satisfies ViewStyle,
  mapFallbackTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: UI.textPrimary,
  } satisfies TextStyle,
  mapFallbackAction: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: ScreenUI.primary,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  mapFallbackActionText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "700",
  } satisfies TextStyle,
  evidenceImage: {
    width: "100%",
    height: 180,
    borderRadius: ScreenUI.radius,
    backgroundColor: "#E5E7EB",
  } satisfies ImageStyle,
  evidenceImageFallback: {
    width: "100%",
    height: 180,
    borderRadius: ScreenUI.radius,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } satisfies ViewStyle,
  evidenceImageFallbackText: {
    fontSize: 12,
    fontWeight: "600",
    color: UI.textSecondary,
  } satisfies TextStyle,
  footerActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: UI.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  } satisfies ViewStyle,
  footerNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  } satisfies ViewStyle,
  secondaryFooterButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: ScreenUI.radius,
    backgroundColor: "#0E7490",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  } satisfies ViewStyle,
  secondaryFooterButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "700",
  } satisfies TextStyle,
  ghostFooterButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: "#0E7490",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  } satisfies ViewStyle,
  ghostFooterButtonText: {
    color: "#0E7490",
    fontSize: 13,
    fontWeight: "700",
  } satisfies TextStyle,
  confirmButton: {
    minHeight: 52,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  confirmButtonDisabled: {
    opacity: 0.7,
  } satisfies ViewStyle,
  confirmButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: "700",
  } satisfies TextStyle,
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    gap: 12,
  } satisfies ViewStyle,
  errorText: {
    fontSize: 14,
    color: "#B42318",
    fontWeight: "600",
    textAlign: "center",
  } satisfies TextStyle,
  stateActionButton: {
    minHeight: 44,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  } satisfies ViewStyle,
  stateActionText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "700",
  } satisfies TextStyle,
});
