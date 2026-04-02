"""
Admin Analytics Service – aggregate queries for dashboard & trends.
All queries use MongoDB aggregation pipelines for efficiency.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Literal

from app.config.database import get_complaints_collection, get_users_collection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _get_date_bounds(period: Literal["daily", "weekly"]) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start = now - timedelta(days=28)  # 4 weeks
    else:
        start = now - timedelta(days=30)  # last 30 days (daily buckets)
    return start, now


# ---------------------------------------------------------------------------
# Analytics service
# ---------------------------------------------------------------------------
class AnalyticsService:

    async def get_overview(self) -> dict:
        """
        Returns:
          - total complaints
          - complaints per category
          - complaints per department
          - resolution rate (%)
          - pending vs resolved ratio
          - total users
        """
        col = get_complaints_collection()

        # Total & status breakdown
        total = await col.count_documents({})
        pending = await col.count_documents({"status": "pending"})
        in_progress = await col.count_documents({"status": "in_progress"})
        resolved = await col.count_documents({"status": "resolved"})
        rejected = await col.count_documents({"status": "rejected"})

        # Resolution rate
        resolution_rate = round((resolved / total * 100), 2) if total else 0.0

        # Per-category breakdown
        cat_pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        cat_docs = await col.aggregate(cat_pipeline).to_list(length=20)
        by_category = {d["_id"]: d["count"] for d in cat_docs}

        # Per-department breakdown
        dept_pipeline = [
            {"$group": {"_id": "$department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        dept_docs = await col.aggregate(dept_pipeline).to_list(length=20)
        by_department = {d["_id"]: d["count"] for d in dept_docs}

        # Per-priority breakdown
        pri_pipeline = [
            {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
        ]
        pri_docs = await col.aggregate(pri_pipeline).to_list(length=10)
        by_priority = {d["_id"]: d["count"] for d in pri_docs}

        # Total users
        total_users = await get_users_collection().count_documents({})

        return {
            "total_complaints": total,
            "total_users": total_users,
            "by_status": {
                "pending": pending,
                "in_progress": in_progress,
                "resolved": resolved,
                "rejected": rejected,
            },
            "by_category": by_category,
            "by_department": by_department,
            "by_priority": by_priority,
            "resolution_rate_percent": resolution_rate,
            "pending_vs_resolved": {
                "pending": pending,
                "resolved": resolved,
                "ratio": round(pending / resolved, 2) if resolved else None,
            },
        }

    async def get_trends(self, period: Literal["daily", "weekly"] = "daily") -> dict:
        """
        Returns complaint counts over time bucketed by day or week.
        """
        col = get_complaints_collection()
        start, end = _get_date_bounds(period)

        if period == "daily":
            date_format = "%Y-%m-%d"
            group_id = {
                "year": {"$year": "$createdAt"},
                "month": {"$month": "$createdAt"},
                "day": {"$dayOfMonth": "$createdAt"},
            }
        else:  # weekly
            date_format = "%Y-W%V"
            group_id = {
                "year": {"$year": "$createdAt"},
                "week": {"$week": "$createdAt"},
            }

        pipeline = [
            {"$match": {"createdAt": {"$gte": start, "$lte": end}}},
            {"$group": {"_id": group_id, "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        docs = await col.aggregate(pipeline).to_list(length=100)

        # Format buckets
        buckets = []
        for d in docs:
            gid = d["_id"]
            if period == "daily":
                label = f"{gid['year']}-{gid['month']:02d}-{gid['day']:02d}"
            else:
                label = f"{gid['year']}-W{gid['week']:02d}"
            buckets.append({"date": label, "count": d["count"]})

        # Per-category trend
        cat_pipeline = [
            {"$match": {"createdAt": {"$gte": start, "$lte": end}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        cat_docs = await col.aggregate(cat_pipeline).to_list(length=10)
        top_categories = [{"category": d["_id"], "count": d["count"]} for d in cat_docs]

        return {
            "period": period,
            "from": start.isoformat(),
            "to": end.isoformat(),
            "trend": buckets,
            "top_categories": top_categories,
        }

    async def get_department_performance(self) -> list:
        """Average resolution time per department."""
        col = get_complaints_collection()
        pipeline = [
            {"$match": {"status": "resolved", "resolvedAt": {"$exists": True}}},
            {
                "$project": {
                    "department": 1,
                    "hoursToResolve": {
                        "$divide": [
                            {"$subtract": ["$resolvedAt", "$createdAt"]},
                            3_600_000,  # ms → hours
                        ]
                    },
                }
            },
            {
                "$group": {
                    "_id": "$department",
                    "avg_hours": {"$avg": "$hoursToResolve"},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"avg_hours": 1}},
        ]
        docs = await col.aggregate(pipeline).to_list(length=20)
        return [
            {
                "department": d["_id"],
                "resolved_count": d["count"],
                "avg_resolution_hours": round(d["avg_hours"], 1),
            }
            for d in docs
        ]


analytics_service = AnalyticsService()
