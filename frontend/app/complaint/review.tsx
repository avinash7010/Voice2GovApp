import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type ImageStyle,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Typography } from "../../constants/theme";
import { ScreenUI } from "../../constants/ui";
import { getCachedPushToken } from "../../hooks/usePushNotifications";
import { submitComplaint as submitComplaintApi } from "../../services/api";
import {
    clearComplaintDraft,
    getComplaintDraft,
    type ComplaintDraft,
} from "../../services/complaintDraft";

export default function ComplaintReviewScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<ComplaintDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftImageFailed, setIsDraftImageFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadDraft = async () => {
      try {
        const currentDraft = await getComplaintDraft();
        if (mounted) {
          setDraft(currentDraft);
        }
      } catch {
        if (mounted) {
          Alert.alert("Unable to Load Draft", "Please fill the form again.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDraft();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setIsDraftImageFailed(false);
  }, [draft?.imageUri]);

  const onSubmitComplaint = async () => {
    if (!draft || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      const pushToken = getCachedPushToken();
      const payload = {
        ...draft.payload,
        ...(pushToken ? { push_token: pushToken } : {}),
      };

      const response = await submitComplaintApi(
        payload,
        draft.imageUri ?? null,
      );
      const newComplaintId = String(
        response?.complaintId ?? response?.complaint_id ?? response?.id ?? "",
      ).trim();

      await clearComplaintDraft();

      Alert.alert(
        "Complaint Submitted",
        "Your complaint is now live in activity and feeds.",
        [
          {
            text: newComplaintId ? "View Complaint" : "Go To Dashboard",
            onPress: () => {
              if (newComplaintId) {
                router.replace(`/complaint/${newComplaintId}`);
                return;
              }
              router.replace("/(tabs)/dashboard");
            },
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try again.";
      Alert.alert("Submission Failed", message || "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={ScreenUI.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!draft) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>No Draft Found</Text>
          <Text style={styles.stateText}>
            Start from the create form to review your complaint before
            confirmation.
          </Text>
          <Pressable
            onPress={() => router.replace("/create-complaint")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Back To Form</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.wrapper}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={ScreenUI.textPrimary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Review Complaint</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>
              Check Before Final Confirmation
            </Text>
            <Text style={styles.noticeText}>
              Review everything carefully, then submit your complaint to publish
              it instantly across the app.
            </Text>
          </View>

          <ReviewItem label="TITLE" value={draft.payload.title || "N/A"} />
          <ReviewItem
            label="CATEGORY"
            value={draft.payload.category || "N/A"}
          />
          <ReviewItem
            label="DEPARTMENT"
            value={draft.payload.department || "N/A"}
          />
          <ReviewItem
            label="PRIORITY"
            value={draft.payload.priority || "N/A"}
          />
          <ReviewItem
            label="LOCATION"
            value={draft.payload.location || "N/A"}
          />
          <ReviewItem
            label="DESCRIPTION"
            value={draft.payload.description || "N/A"}
            multiline
          />

          {draft.imageUri ? (
            <View style={styles.itemCard}>
              <Text style={styles.itemLabel}>IMAGE</Text>
              {isDraftImageFailed ? (
                <View style={styles.imageFallbackWrap}>
                  <MaterialCommunityIcons
                    name="image-off-outline"
                    size={24}
                    color={ScreenUI.textSecondary}
                  />
                  <Text style={styles.imageFallbackText}>
                    Image unavailable
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: draft.imageUri }}
                  style={styles.draftImagePreview}
                  onError={() => setIsDraftImageFailed(true)}
                />
              )}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                router.back();
              }}
              style={[styles.actionButton, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>Edit Complaint</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                void onSubmitComplaint();
              }}
              disabled={isSubmitting}
              style={[
                styles.actionButton,
                styles.primaryButton,
                isSubmitting && styles.actionButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Submitting..." : "Submit Complaint"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ReviewItem({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={[styles.itemValue, multiline && styles.multilineValue]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ScreenUI.background,
  } satisfies ViewStyle,
  wrapper: {
    flex: 1,
    backgroundColor: ScreenUI.background,
  } satisfies ViewStyle,
  headerBar: {
    height: ScreenUI.headerHeight,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: ScreenUI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  } satisfies ViewStyle,
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: ScreenUI.textPrimary,
  } satisfies TextStyle,
  headerSpacer: {
    width: 36,
    height: 36,
  } satisfies ViewStyle,
  scrollContent: {
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    paddingTop: ScreenUI.pagePaddingTop,
    paddingBottom: 32,
    gap: 12,
  } satisfies ViewStyle,
  noticeCard: {
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: "#D0E1FD",
    backgroundColor: "#F0F6FF",
    padding: 14,
    gap: 6,
  } satisfies ViewStyle,
  noticeTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: "800",
    color: ScreenUI.primary,
  } satisfies TextStyle,
  noticeText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    color: ScreenUI.textSecondary,
    fontWeight: "500",
  } satisfies TextStyle,
  itemCard: {
    borderRadius: ScreenUI.radius,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 6,
  } satisfies ViewStyle,
  itemLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: ScreenUI.labelGray,
    letterSpacing: 0.6,
  } satisfies TextStyle,
  itemValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
    color: ScreenUI.textPrimary,
  } satisfies TextStyle,
  multilineValue: {
    lineHeight: 22,
    fontWeight: "500",
  } satisfies TextStyle,
  draftImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: ScreenUI.radius,
    backgroundColor: "#E5E7EB",
  } satisfies ImageStyle,
  imageFallbackWrap: {
    width: "100%",
    height: 180,
    borderRadius: ScreenUI.radius,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } satisfies ViewStyle,
  imageFallbackText: {
    fontSize: 12,
    fontWeight: "600",
    color: ScreenUI.textSecondary,
  } satisfies TextStyle,
  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  } satisfies ViewStyle,
  actionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: ScreenUI.radius,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  actionButtonDisabled: {
    opacity: 0.75,
  } satisfies ViewStyle,
  primaryButton: {
    backgroundColor: ScreenUI.primary,
  } satisfies ViewStyle,
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: "700",
  } satisfies TextStyle,
  secondaryButton: {
    borderWidth: 1,
    borderColor: ScreenUI.border,
    backgroundColor: "#FFFFFF",
  } satisfies ViewStyle,
  secondaryButtonText: {
    color: ScreenUI.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: "700",
  } satisfies TextStyle,
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  } satisfies ViewStyle,
  stateTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: ScreenUI.textPrimary,
  } satisfies TextStyle,
  stateText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    color: ScreenUI.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  } satisfies TextStyle,
});
