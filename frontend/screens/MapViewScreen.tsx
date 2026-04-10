import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
    Alert,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "../constants/theme";

const DEFAULT_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lat?: string | string[];
    lng?: string | string[];
    address?: string | string[];
    title?: string | string[];
  }>();

  const latParam = Array.isArray(params.lat) ? params.lat[0] : params.lat;
  const lngParam = Array.isArray(params.lng) ? params.lng[0] : params.lng;
  const addressParam = Array.isArray(params.address)
    ? params.address[0]
    : params.address;
  const titleParam = Array.isArray(params.title)
    ? params.title[0]
    : params.title;

  const latitude = latParam ? Number.parseFloat(latParam) : Number.NaN;
  const longitude = lngParam ? Number.parseFloat(lngParam) : Number.NaN;
  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  const mapRegion: Region = useMemo(() => {
    if (!hasCoordinates) {
      return DEFAULT_REGION;
    }

    return {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [hasCoordinates, latitude, longitude]);

  const openInGoogleMaps = async () => {
    const query = hasCoordinates
      ? `${latitude},${longitude}`
      : addressParam
        ? encodeURIComponent(addressParam)
        : "";

    if (!query) {
      Alert.alert(
        "Location unavailable",
        "No location is available for this complaint.",
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unable to open map", "This device cannot open map links.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open map", "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.wrapper}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={Colors.text}
            />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {titleParam?.trim() ? titleParam : "Complaint Location"}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {hasCoordinates ? (
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            region={mapRegion}
          >
            <Marker
              coordinate={{ latitude, longitude }}
              title="Complaint Location"
            />
          </MapView>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="map-marker-off-outline"
              size={34}
              color="#64748B"
            />
            <Text style={styles.emptyStateTitle}>Location unavailable</Text>
            <Text style={styles.emptyStateText}>
              We could not find exact coordinates for this complaint.
            </Text>
          </View>
        )}

        <View style={styles.bottomBar}>
          <Pressable
            style={styles.googleMapsButton}
            onPress={() => {
              void openInGoogleMaps();
            }}
          >
            <Text style={styles.googleMapsButtonText}>Open in Google Maps</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  } satisfies ViewStyle,
  wrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  } satisfies ViewStyle,
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  } satisfies ViewStyle,
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
    marginHorizontal: 8,
  } satisfies TextStyle,
  headerSpacer: {
    width: 36,
    height: 36,
  } satisfies ViewStyle,
  map: {
    flex: 1,
  } satisfies ViewStyle,
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: "#F8FAFC",
  } satisfies ViewStyle,
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  } satisfies TextStyle,
  emptyStateText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#475569",
    textAlign: "center",
  } satisfies TextStyle,
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
  } satisfies ViewStyle,
  googleMapsButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#0E7490",
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  googleMapsButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
  } satisfies TextStyle,
});
