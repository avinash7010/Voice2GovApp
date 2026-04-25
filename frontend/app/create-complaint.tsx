import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
    ImageStyle,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { VoiceRecorder } from "../components/VoiceRecorder";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Header } from "../components/ui/Header";
import { Input } from "../components/ui/Input";
import { BorderRadius, Colors, Typography } from "../constants/theme";
import { useUserLocation } from "../hooks/useUserLocation";
import {
    normalizeComplaintCategory,
    uploadVoiceForTranscription,
    type ComplaintPayload,
} from "../services/api";
import { saveComplaintDraft } from "../services/complaintDraft";

const CATEGORY_OPTIONS = [
  { label: "Infrastructure", value: "other" },
  { label: "Water", value: "water" },
  { label: "Sanitation", value: "sanitation" },
  { label: "Roads", value: "road" },
  { label: "Garbage", value: "sanitation" },
  { label: "Fire Accident", value: "other" },
  { label: "Electricity", value: "electricity" },
] as const;

const DEPARTMENT_OPTIONS = [
  { label: "Public Works", value: "public_works" },
  { label: "Water Department", value: "water_department" },
  { label: "Sanitation", value: "sanitation_department" },
  { label: "Roads & Transport", value: "roads_transport" },
] as const;

const PRIORITY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
] as const;

const DEFAULT_AVATAR_URL =
  "https://ui-avatars.com/api/?name=User&background=1C4980&color=fff";

const DEFAULT_COORDINATES = {
  latitude: 20.5937,
  longitude: 78.9629,
};

const DEFAULT_REGION: Region = {
  ...DEFAULT_COORDINATES,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const INITIAL_COMPLAINT: ComplaintPayload = {
  title: "",
  description: "",
  category: "",
  department: "",
  priority: "",
  location: "",
};

type FormField = keyof ComplaintPayload;

export default function CreateComplaintScreen() {
  const router = useRouter();
  const mapRef = React.useRef<MapView | null>(null);
  const [complaint, setComplaint] =
    useState<ComplaintPayload>(INITIAL_COMPLAINT);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [autoDetectedCategory, setAutoDetectedCategory] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationTouched, setIsLocationTouched] = useState(false);
  const {
    locationName,
    latitude,
    longitude,
    isLoading: isLocationLoading,
    refreshLocation,
  } = useUserLocation();

  const hasUserCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0);

  const canSubmit = useMemo(() => {
    return [
      complaint.title.trim(),
      complaint.description.trim(),
      complaint.category.trim(),
      complaint.department.trim(),
      complaint.priority.trim(),
      complaint.location.trim(),
    ].every((value) => value.length > 0);
  }, [complaint]);

  useEffect(() => {
    if (isLocationTouched || !locationName) {
      return;
    }

    setComplaint((prev) => {
      if (prev.location === locationName) {
        return prev;
      }

      return { ...prev, location: locationName };
    });
  }, [isLocationTouched, locationName]);

  useEffect(() => {
    if (!hasUserCoordinates || isLocationTouched) {
      return;
    }

    setSelectedCoordinates({ latitude, longitude });
  }, [hasUserCoordinates, isLocationTouched, latitude, longitude]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const targetRegion: Region = selectedCoordinates
      ? {
          latitude: selectedCoordinates.latitude,
          longitude: selectedCoordinates.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }
      : DEFAULT_REGION;

    mapRef.current.animateToRegion(targetRegion, 450);
  }, [selectedCoordinates]);

  const onChangeField = (field: FormField, value: string) => {
    if (field === "location") {
      setIsLocationTouched(true);
      setSelectedCoordinates(null);
    }

    setComplaint((prev) => ({ ...prev, [field]: value }));
  };

  const onUseCurrentLocation = async () => {
    if (isSubmitting || isLocationLoading) {
      return;
    }

    const latestLocation = await refreshLocation();
    setIsLocationTouched(true);
    if (
      Number.isFinite(latestLocation.latitude) &&
      Number.isFinite(latestLocation.longitude) &&
      !(latestLocation.latitude === 0 && latestLocation.longitude === 0)
    ) {
      setSelectedCoordinates({
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
      });
    }
    setComplaint((prev) => ({
      ...prev,
      location: latestLocation.locationName || "Location unavailable",
    }));
  };

  const getPickerMediaTypes = (
    allowVideos = false,
  ): ImagePicker.MediaType[] => {
    return allowVideos ? ["images", "videos"] : ["images"];
  };

  const onPickImage = async () => {
    if (isSubmitting) {
      return;
    }

    try {
      const currentPermission =
        await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!currentPermission.granted) {
        const requestedPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!requestedPermission.granted) {
          Alert.alert(
            "Permission Needed",
            "Please allow photo library access to upload a proof image.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getPickerMediaTypes(false),
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Image Error", "Unable to read the selected image.");
        return;
      }

      setSelectedImageUri(asset.uri);
    } catch {
      Alert.alert("Upload Failed", "Could not select image. Please try again.");
    }
  };

  const submitComplaint = async () => {
    if (isSubmitting) {
      return;
    }

    const title = complaint.title.trim();
    const description = complaint.description.trim();
    const category = complaint.category.trim();
    const department = complaint.department.trim();
    const priority = complaint.priority.trim();
    const location = complaint.location.trim();

    if (
      !title ||
      !description ||
      !category ||
      !department ||
      !priority ||
      !location
    ) {
      Alert.alert(
        "Missing Details",
        "Please complete title, category, department, priority, location, and description before submitting.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: ComplaintPayload = {
        title,
        description,
        category,
        department,
        priority,
        location,
      };

      await saveComplaintDraft({
        payload,
        imageUri: selectedImageUri,
        coordinates: selectedCoordinates,
      });

      router.push("/complaint/review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      Alert.alert("Could Not Continue", message || "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const transcribeRecordedAudio = async (fileUri: string) => {
    const trimmedUri = fileUri.trim();
    if (!trimmedUri) {
      return;
    }

    try {
      setIsTranscribing(true);
      setTranscriptionError("");
      setAutoDetectedCategory("");

      const result = await uploadVoiceForTranscription(trimmedUri);
      const text = result.transcription.trim();
      const detectedCategory = normalizeComplaintCategory(text);

      setTranscriptionText(text);
      setComplaint((prev) => {
        const next: ComplaintPayload = {
          ...prev,
          description: text,
        };

        if (
          (!prev.category || prev.category === "other") &&
          detectedCategory &&
          detectedCategory !== "other"
        ) {
          next.category = detectedCategory;
          setAutoDetectedCategory(detectedCategory);
        }

        return next;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to transcribe audio";
      setTranscriptionError(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.wrapper}>
        <Header
          title="Voice2Gov"
          leftComponent={
            <MaterialCommunityIcons
              name="gavel"
              size={20}
              color={Colors.primary}
            />
          }
          rightComponent={
            <Avatar source={{ uri: DEFAULT_AVATAR_URL }} size={40} />
          }
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Create Complaint</Text>
            <Text style={styles.pageSubtitle}>
              Fill in the details below to submit your complaint.
            </Text>
          </View>

          <Card>
            <Input
              label="Title"
              value={complaint.title}
              onChangeText={(value) => onChangeField("title", value)}
              placeholder="Enter complaint title"
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <OptionGrid
              options={CATEGORY_OPTIONS}
              value={complaint.category}
              onChange={(value) => onChangeField("category", value)}
            />

            <Text style={styles.fieldLabel}>Department</Text>
            <OptionGrid
              options={DEPARTMENT_OPTIONS}
              value={complaint.department}
              onChange={(value) => onChangeField("department", value)}
            />

            <Text style={styles.fieldLabel}>Priority</Text>
            <OptionGrid
              options={PRIORITY_OPTIONS}
              value={complaint.priority}
              onChange={(value) => onChangeField("priority", value)}
            />

            <Input
              label="Location"
              value={complaint.location}
              onChangeText={(value) => onChangeField("location", value)}
              placeholder="Enter location"
            />
            <Button
              title="Use Current Location"
              variant="secondary"
              loading={isLocationLoading}
              disabled={isSubmitting}
              onPress={() => {
                void onUseCurrentLocation();
              }}
            />

            <View style={styles.mapPreviewCard}>
              <MapView
                ref={mapRef}
                style={styles.mapPreview}
                initialRegion={selectedCoordinates ? undefined : DEFAULT_REGION}
                region={
                  selectedCoordinates
                    ? {
                        latitude: selectedCoordinates.latitude,
                        longitude: selectedCoordinates.longitude,
                        latitudeDelta: 0.012,
                        longitudeDelta: 0.012,
                      }
                    : DEFAULT_REGION
                }
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                showsUserLocation={Boolean(selectedCoordinates)}
                showsMyLocationButton={false}
              >
                {selectedCoordinates ? (
                  <Marker coordinate={selectedCoordinates} />
                ) : null}
              </MapView>

              <View style={styles.mapOverlay} pointerEvents="none">
                <View style={styles.mapBadge}>
                  <MaterialCommunityIcons
                    name="map-marker-radius"
                    size={14}
                    color={Colors.primary}
                  />
                  <Text style={styles.mapBadgeText}>Map Preview</Text>
                </View>
                <Text style={styles.mapOverlayText}>
                  {selectedCoordinates
                    ? "Centered on the selected location"
                    : "Preview will center when a location is selected"}
                </Text>
              </View>
            </View>

            <Input
              label="Description"
              value={complaint.description}
              onChangeText={(value) => onChangeField("description", value)}
              placeholder="Describe the issue"
              multiline
            />

            <Text style={styles.fieldLabel}>Image Upload</Text>
            <Pressable
              onPress={() => {
                void onPickImage();
              }}
              disabled={isSubmitting}
              style={[
                styles.uploadButton,
                isSubmitting && styles.disabledButton,
              ]}
            >
              <MaterialCommunityIcons
                name="image-plus"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.uploadButtonText}>Upload Image</Text>
            </Pressable>

            {selectedImageUri ? (
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.imagePreview}
              />
            ) : (
              <Text style={styles.imageHintText}>
                No image selected (optional)
              </Text>
            )}

            <Text style={styles.fieldLabel}>Voice Note</Text>
            <VoiceRecorder
              disabled={isSubmitting || isTranscribing}
              onRecorded={(uri) => {
                setRecordedAudioUri(uri);
                void transcribeRecordedAudio(uri);
              }}
            />
            {recordedAudioUri ? (
              <Text style={styles.audioHintText}>
                Recorded file: {recordedAudioUri}
              </Text>
            ) : (
              <Text style={styles.imageHintText}>
                No voice note recorded yet (optional)
              </Text>
            )}

            {isTranscribing ? (
              <Text style={styles.audioHintText}>
                Transcribing voice note...
              </Text>
            ) : null}

            {transcriptionText ? (
              <View style={styles.transcriptionCard}>
                <Input
                  label="Transcription Preview (Editable)"
                  value={transcriptionText}
                  onChangeText={(value) => {
                    setTranscriptionText(value);
                    onChangeField("description", value);
                  }}
                  placeholder="Transcribed complaint text"
                  multiline
                />
                {autoDetectedCategory ? (
                  <Text style={styles.transcriptionMetaText}>
                    Auto-detected category: {autoDetectedCategory}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {transcriptionError ? (
              <Text style={styles.audioErrorText}>{transcriptionError}</Text>
            ) : null}
          </Card>

          <Button
            title="Review Complaint"
            variant="primary"
            loading={isSubmitting}
            disabled={!canSubmit}
            onPress={() => {
              void submitComplaint();
            }}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function OptionGrid<T extends { label: string; value: string }>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.optionGrid}>
      {options.map((option, index) => {
        const selected = value === option.value;

        return (
          <Pressable
            key={`${option.value}-${index}`}
            onPress={() => onChange(option.value)}
            style={[styles.optionChip, selected && styles.optionChipSelected]}
          >
            <Text
              style={[styles.optionText, selected && styles.optionTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  } satisfies ViewStyle,
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  } satisfies ViewStyle,
  softShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } satisfies ViewStyle,
  header: {
    height: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  } satisfies ViewStyle,
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  } satisfies ViewStyle,
  appTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.2,
  } satisfies TextStyle,
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  } satisfies ViewStyle,
  avatarImage: {
    width: "100%",
    height: "100%",
  } satisfies ImageStyle,
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  } satisfies ViewStyle,
  pageHeader: {
    marginBottom: 16,
  } satisfies ViewStyle,
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 6,
    letterSpacing: -0.3,
  } satisfies TextStyle,
  pageSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
    lineHeight: 19,
    maxWidth: 330,
  } satisfies TextStyle,
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  } satisfies ViewStyle,
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.labelGray,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  } satisfies TextStyle,
  textInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  } satisfies TextStyle,
  descriptionInput: {
    minHeight: 112,
    paddingTop: 14,
  } satisfies TextStyle,
  mapPreviewCard: {
    marginTop: 10,
    height: 168,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    backgroundColor: Colors.card,
    position: "relative",
  } satisfies ViewStyle,
  mapPreview: {
    flex: 1,
  } satisfies ViewStyle,
  mapOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    gap: 4,
  } satisfies ViewStyle,
  mapBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: Colors.border,
  } satisfies ViewStyle,
  mapBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  } satisfies TextStyle,
  mapOverlayText: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  } satisfies TextStyle,
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } satisfies ViewStyle,
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
  } satisfies ViewStyle,
  optionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  } satisfies ViewStyle,
  optionText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "capitalize",
  } satisfies TextStyle,
  optionTextSelected: {
    color: "#FFFFFF",
  } satisfies TextStyle,
  locationButton: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#F2F6FC",
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  locationButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
    color: Colors.primary,
  } satisfies TextStyle,
  uploadButton: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#F2F6FC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  } satisfies ViewStyle,
  uploadButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
    color: Colors.primary,
  } satisfies TextStyle,
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: BorderRadius.lg,
  } satisfies ImageStyle,
  imageHintText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  } satisfies TextStyle,
  audioHintText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  } satisfies TextStyle,
  audioErrorText: {
    fontSize: Typography.fontSize.sm,
    color: "#B42318",
    fontWeight: "600",
  } satisfies TextStyle,
  transcriptionCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    gap: 6,
  } satisfies ViewStyle,
  transcriptionMetaText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: "600",
  } satisfies TextStyle,
  submitButton: {
    marginTop: 16,
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  submitDisabled: {
    opacity: 0.6,
  } satisfies ViewStyle,
  submitText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: "700",
  } satisfies TextStyle,
  disabledButton: {
    opacity: 0.7,
  } satisfies ViewStyle,
});
