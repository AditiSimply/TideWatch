from typing import Any, Dict, List, Optional
import uuid
from app.schemas.common import CamelModel


class PredictRequest(CamelModel):
    features: Dict[str, float]
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: Optional[str] = None
    persist: bool = True


class ContributingFeature(CamelModel):
    feature: str
    value: float = 0.0
    importance: float = 0.0
    deviation: float = 0.0
    importance_weight: Optional[float] = None
    standardized_z_score: Optional[float] = None
    direction: Optional[str] = None
    impact: Optional[str] = None


class PredictResponse(CamelModel):
    prediction: str
    confidence: float
    is_anomaly: bool
    top_contributing_features: List[ContributingFeature]
    probabilities: Dict[str, float]
    flow_id: Optional[uuid.UUID] = None
    alert_id: Optional[uuid.UUID] = None


class BatchPredictRow(CamelModel):
    row_id: int
    flow_id: Optional[uuid.UUID] = None
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    prediction: str
    confidence: float
    is_anomaly: bool
    alert_id: Optional[uuid.UUID] = None


class BatchSummary(CamelModel):
    total_rows: int
    attacks_count: int
    benign_count: int
    attack_ratio: float
    # Aliases for frontend flexibility
    total: Optional[int] = None
    attacks: Optional[int] = None
    benign: Optional[int] = None


class BatchPredictResponse(CamelModel):
    """
    Matches both frontend expectation {items: [...], summary: {...}}
    and flat test expectations {total_rows: ..., results: [...]}.
    """
    items: List[BatchPredictRow]
    summary: BatchSummary
    total_rows: Optional[int] = None
    attacks_count: Optional[int] = None
    benign_count: Optional[int] = None
    results: Optional[List[BatchPredictRow]] = None
