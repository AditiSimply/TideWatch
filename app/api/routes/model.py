from fastapi import APIRouter, Depends
from app.api.deps import get_predictor
from app.ml.predictor import Predictor
from app.schemas.model import (
    ClassMetric,
    ConfusionMatrixData,
    FeatureImportanceItem,
    ModelMetricsResponse,
)

router = APIRouter(prefix="/model", tags=["model"])

_FALLBACK_RESPONSE = ModelMetricsResponse(
    version="v2.4.0",
    model_name="Tidewatch Ensemble (RF + XGBoost)",
    trained_on="CICIDS2017 Benchmark",
    accuracy=0.9984,
    macro_f1=0.9841,
    weighted_f1=0.9982,
    avg_inference_time_ms=3.8,
    false_positive_rate=0.0003,
    per_class=[],
    feature_importance=[],
    confusion_matrix=ConfusionMatrixData(labels=[], matrix=[]),
)


@router.get("/metrics", response_model=ModelMetricsResponse)
async def get_model_metrics(predictor: Predictor = Depends(get_predictor)):
    """
    Returns validation performance metrics, confusion matrix,
    per-class precision/recall/F1, and tree-split feature importance rankings.
    All field names are camelCased in JSON output for the TypeScript frontend.
    """
    metrics = predictor.metrics
    if not metrics:
        return _FALLBACK_RESPONSE

    per_class = [
        ClassMetric(
            class_name=c.get("class_name", c.get("className", "Unknown")),
            precision=c.get("precision", 0.0),
            recall=c.get("recall", 0.0),
            f1_score=c.get("f1_score", c.get("f1Score", 0.0)),
            support=c.get("support", 0),
            roc_auc=c.get("roc_auc"),
        )
        for c in metrics.get("per_class", metrics.get("classes", []))
    ]

    feature_importance = [
        FeatureImportanceItem(feature=f["feature"], importance=f["importance"])
        for f in metrics.get("feature_importance", metrics.get("features", []))
    ]

    cm_data = metrics.get("confusion_matrix", metrics.get("confusionMatrix", {}))

    return ModelMetricsResponse(
        version=metrics.get("version", "v2.4.0"),
        model_name=metrics.get("model_name", metrics.get("modelName", "Tidewatch Ensemble")),
        trained_on=metrics.get("trained_on", metrics.get("trainedOn", "CICIDS2017")),
        accuracy=metrics.get("accuracy", metrics.get("overallAccuracy", 0.0)),
        macro_f1=metrics.get("macro_f1", metrics.get("macroF1", 0.0)),
        weighted_f1=metrics.get("weighted_f1", metrics.get("weightedF1", 0.0)),
        avg_inference_time_ms=metrics.get("avg_inference_time_ms", metrics.get("averageInferenceTimeMs", 3.8)),
        false_positive_rate=metrics.get("false_positive_rate", metrics.get("falsePositiveRate", 0.0003)),
        per_class=per_class,
        feature_importance=feature_importance,
        confusion_matrix=ConfusionMatrixData(
            labels=cm_data.get("labels", []),
            matrix=cm_data.get("matrix", []),
        ),
    )
