import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type UserLocation = {
  locationName: string;
  latitude: number;
  longitude: number;
};

const FALLBACK_LOCATION: UserLocation = {
  locationName: "Location unavailable",
  latitude: 0,
  longitude: 0,
};

function formatAddress(address?: Location.LocationGeocodedAddress) {
  if (!address) {
    return "Unknown";
  }

  const parts = [
    address.name,
    address.street,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

export function useUserLocation() {
  const [userLocation, setUserLocation] =
    useState<UserLocation>(FALLBACK_LOCATION);
  const [isLoading, setIsLoading] = useState(false);

  const resolveLocation = async (shouldPersist = true) => {
    setIsLoading(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (shouldPersist) {
          setUserLocation(FALLBACK_LOCATION);
        }
        return FALLBACK_LOCATION;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentPosition.coords;

      let locationName = "Location unavailable";
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        locationName = formatAddress(geocode[0]);
      } catch {
        // Keep fallback location label when reverse geocoding fails.
      }

      const resolvedLocation = {
        locationName,
        latitude,
        longitude,
      };

      if (shouldPersist) {
        setUserLocation(resolvedLocation);
      }
      return resolvedLocation;
    } catch {
      if (shouldPersist) {
        setUserLocation(FALLBACK_LOCATION);
      }
      return FALLBACK_LOCATION;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      await resolveLocation(isMounted);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...userLocation,
    isLoading,
    refreshLocation: resolveLocation,
  };
}
