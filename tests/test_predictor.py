import pytest
from fastapi import HTTPException
from app.ml.predictor import Predictor


def test_predictor_loads_cleanly(predictor: Predictor):
    assert predictor.model is not None
    assert predictor.scaler is not None
    assert predictor.label_encoder is not None
    assert len(predictor.feature_names) > 0


def test_prediction_with_valid_features(predictor: Predictor, valid_features: dict):
    result = predictor.predict(valid_features)
    assert "prediction" in result
    assert "confidence" in result
    assert "is_anomaly" in result
    assert "top_contributing_features" in result
    assert len(result["top_contributing_features"]) > 0
    assert 0.0 <= result["confidence"] <= 1.0


def test_missing_feature_raises_422(predictor: Predictor, valid_features: dict):
    invalid_features = valid_features.copy()
    # Remove one required feature
    first_key = predictor.feature_names[0]
    del invalid_features[first_key]

    with pytest.raises(HTTPException) as exc_info:
        predictor.predict(invalid_features)

    assert exc_info.value.status_code == 422
    assert "Missing" in exc_info.value.detail["message"]
    assert first_key in exc_info.value.detail["missing_features"]


def test_extra_feature_raises_422(predictor: Predictor, valid_features: dict):
    invalid_features = valid_features.copy()
    invalid_features["UNKNOWN_EXTRA_COLUMN"] = 999.0

    with pytest.raises(HTTPException) as exc_info:
        predictor.predict(invalid_features)

    assert exc_info.value.status_code == 422
    assert "Unexpected" in exc_info.value.detail["message"]
    assert "UNKNOWN_EXTRA_COLUMN" in exc_info.value.detail["unexpected_features"]
