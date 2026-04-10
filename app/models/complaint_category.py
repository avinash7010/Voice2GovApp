"""Canonical complaint category values shared across services and schemas."""
from enum import Enum


class ComplaintCategory(str, Enum):
    ROAD = "road"
    SANITATION = "sanitation"
    WATER = "water"
    ELECTRICITY = "electricity"
    OTHER = "other"