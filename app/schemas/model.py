from typing import Any, Dict, List, Optional
from app.schemas.common import CamelModel


class ClassMetric(CamelModel):
    class_name: str
    precision: float
    recall: float
    f1_score: float
    support: int
    roc_auc: Optional[float] = None


class FeatureImportanceItem(CamelModel):
    feature: str
    importance: float


class ConfusionMatrixData(CamelModel):
    labels: List[str]
    matrix: List[List[int]]


class ModelMetricsResponse(CamelModel):
    version: str
    model_name: str
    trained_on: str
    accuracy: float
    macro_f1: float
    weighted_f1: float
    avg_inference_time_ms: float
    false_positive_rate: float
    per_class: List[ClassMetric]
    feature_importance: List[FeatureImportanceItem]
    confusion_matrix: ConfusionMatrixData
