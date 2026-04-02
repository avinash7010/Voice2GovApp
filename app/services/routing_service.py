"""
Routing Service – OpenStreetMap / Nominatim geocoding and location enrichment.
Uses geopy (async-friendly via asyncio.to_thread) so it does not block the event loop.
"""
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class RoutingService:
    """Wraps Nominatim for reverse-geocoding and address lookup."""

    _geolocator = None

    @classmethod
    def _get_geolocator(cls):
        if cls._geolocator is None:
            try:
                from geopy.geocoders import Nominatim  # noqa: WPS433
                cls._geolocator = Nominatim(user_agent="voice2gov-app/1.0")
                logger.info("✅  Nominatim geolocator ready")
            except Exception as exc:
                logger.warning("⚠️  geopy unavailable: %s", exc)
                cls._geolocator = False
        return cls._geolocator

    async def reverse_geocode(self, lat: float, lng: float) -> Optional[str]:
        """
        Convert lat/lng to a human-readable address using OpenStreetMap Nominatim.
        Returns None if geocoding fails or geopy is unavailable.
        """
        geolocator = self._get_geolocator()
        if not geolocator:
            return None
        try:
            location = await asyncio.to_thread(
                geolocator.reverse, f"{lat},{lng}", language="en", timeout=5
            )
            return location.address if location else None
        except Exception as exc:
            logger.warning("Reverse geocode failed (%s, %s): %s", lat, lng, exc)
            return None

    async def forward_geocode(self, address: str) -> Optional[dict]:
        """
        Convert a text address to lat/lng.
        Returns {'lat': float, 'lng': float, 'display_name': str} or None.
        """
        geolocator = self._get_geolocator()
        if not geolocator:
            return None
        try:
            location = await asyncio.to_thread(
                geolocator.geocode, address, timeout=5
            )
            if location:
                return {
                    "lat": location.latitude,
                    "lng": location.longitude,
                    "display_name": location.address,
                }
        except Exception as exc:
            logger.warning("Forward geocode failed '%s': %s", address, exc)
        return None


routing_service = RoutingService()
