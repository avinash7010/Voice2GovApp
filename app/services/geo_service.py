"""
Geo Intelligence Service – cluster complaints and detect hotspots.

Algorithm
---------
- Uses a simple grid-based clustering (lat/lng bucketed to ~1 km cells).
- A "hotspot" is any cell with ≥ HOTSPOT_THRESHOLD complaints.
- Each complaint is assigned a `clusterId` = "<lat_bucket>:<lng_bucket>".

1° latitude ≈ 111 km  →  0.009° ≈ 1 km
1° longitude ≈ 111 km × cos(lat)  –  we approximate with 0.009° as well.
"""
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.config.database import get_complaints_collection
from app.config.settings import settings

logger = logging.getLogger(__name__)

# Size of each grid cell in degrees (~1 km)
GRID_CELL_DEG = 0.009
HOTSPOT_THRESHOLD = 3        # min complaints in a cell to declare hotspot
NEARBY_RADIUS_DEG = settings.DUPLICATE_NEARBY_RADIUS_DEG    # search radius for nearby complaints


def _cluster_id(lat: float, lng: float) -> str:
    """Return a string cluster key for coordinates bucket."""
    lat_bucket = math.floor(lat / GRID_CELL_DEG)
    lng_bucket = math.floor(lng / GRID_CELL_DEG)
    return f"{lat_bucket}:{lng_bucket}"


def _cell_center(cluster_id: str) -> tuple[float, float]:
    """Return approximate center lat/lng for a cluster cell."""
    lat_b, lng_b = map(int, cluster_id.split(":"))
    return (
        (lat_b + 0.5) * GRID_CELL_DEG,
        (lng_b + 0.5) * GRID_CELL_DEG,
    )


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------
class GeoService:

    async def assign_cluster_id(self, complaint_id: str, lat: float, lng: float) -> str:
        """Compute and persist clusterId for a complaint."""
        from bson import ObjectId
        cid = _cluster_id(lat, lng)
        await get_complaints_collection().update_one(
            {"_id": ObjectId(complaint_id)},
            {"$set": {"clusterId": cid, "updatedAt": datetime.now(timezone.utc)}},
        )
        return cid

    async def batch_assign_clusters(self) -> int:
        """Backfill clusterId for all complaints with location but no clusterId."""
        col = get_complaints_collection()
        cursor = col.find({"location": {"$ne": None}, "clusterId": {"$exists": False}})
        updated = 0
        async for doc in cursor:
            loc = doc.get("location", {})
            lat = loc.get("lat")
            lng = loc.get("lng")
            if lat is not None and lng is not None:
                cid = _cluster_id(lat, lng)
                await col.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"clusterId": cid}},
                )
                updated += 1
        logger.info("batch_assign_clusters: updated %d documents", updated)
        return updated

    async def get_hotspots(
        self,
        min_complaints: int = HOTSPOT_THRESHOLD,
        days: int = 30,
        category: Optional[str] = None,
    ) -> list:
        """
        Return clusters with ≥ min_complaints in the last `days` days.
        Each result includes center coordinates, count, top category, and avg priority score.
        """
        col = get_complaints_collection()
        since = datetime.now(timezone.utc) - timedelta(days=days)

        match: dict = {
            "clusterId": {"$exists": True},
            "createdAt": {"$gte": since},
        }
        if category:
            match["category"] = category

        pipeline = [
            {"$match": match},
            {
                "$group": {
                    "_id": "$clusterId",
                    "count": {"$sum": 1},
                    "categories": {"$push": "$category"},
                    "statuses": {"$push": "$status"},
                    "avg_lat": {"$avg": "$location.lat"},
                    "avg_lng": {"$avg": "$location.lng"},
                    "latest_complaint": {"$max": "$createdAt"},
                }
            },
            {"$match": {"count": {"$gte": min_complaints}}},
            {"$sort": {"count": -1}},
            {"$limit": 20},
        ]
        docs = await col.aggregate(pipeline).to_list(length=20)

        hotspots = []
        for d in docs:
            # Determine dominant category
            cats = d.get("categories", [])
            top_cat = max(set(cats), key=cats.count) if cats else "other"

            # Pending ratio
            statuses = d.get("statuses", [])
            pending_count = statuses.count("pending")
            pending_ratio = round(pending_count / len(statuses) * 100, 1) if statuses else 0

            hotspots.append({
                "clusterId": d["_id"],
                "complaint_count": d["count"],
                "center": {
                    "lat": round(d.get("avg_lat", 0), 6),
                    "lng": round(d.get("avg_lng", 0), 6),
                },
                "top_category": top_cat,
                "pending_percent": pending_ratio,
                "latest_complaint": d.get("latest_complaint"),
                "severity": (
                    "critical" if d["count"] >= 10
                    else "high" if d["count"] >= 5
                    else "moderate"
                ),
            })
        return hotspots

    async def get_nearby_complaints(
        self,
        lat: float,
        lng: float,
        radius_deg: float = NEARBY_RADIUS_DEG,
    ) -> list:
        """Return complaints near a coordinate (bounding box approximation)."""
        col = get_complaints_collection()
        query = {
            "location.lat": {"$gte": lat - radius_deg, "$lte": lat + radius_deg},
            "location.lng": {"$gte": lng - radius_deg, "$lte": lng + radius_deg},
        }
        cursor = col.find(query).sort("createdAt", -1).limit(50)
        docs = await cursor.to_list(length=50)
        return docs


geo_service = GeoService()
