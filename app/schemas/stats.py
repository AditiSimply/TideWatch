from typing import List
from app.schemas.common import CamelModel


class StatsOverviewResponse(CamelModel):
    total_flows: int
    attacks_detected: int
    attack_rate: float
    avg_confidence: float
    active_threats: int
    flows_last_minute: int


class TimeseriesPoint(CamelModel):
    timestamp: str
    time_label: str
    benign_flows: int
    attack_flows: int
    total_bandwidth_mb: float


class TopSourceMetric(CamelModel):
    ip: str
    country: str
    flows_count: int
    threat_score: int
    primary_attack: str
    last_seen: str


class AttackDistItem(CamelModel):
    name: str
    count: int
    percentage: float
    color: str
