from pathlib import Path
from typing import Any, Dict, List, Tuple
from fastapi import HTTPException
import joblib
import json
import numpy as np
import pandas as pd
from app.core.config import settings
from app.core.logging import logger


class Predictor:
    """
    ML Predictor singleton loaded once at application startup.
    Validates column alignment and computes predictions with feature contributions.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, artifacts_dir: str | None = None):
        if getattr(self, "_initialized", False):
            return

        self.artifacts_dir = Path(artifacts_dir or settings.MODEL_ARTIFACTS_DIR)
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.feature_names: List[str] = []
        self.metrics: Dict[str, Any] = {}
        self.load_artifacts()
        self._initialized = True

    def load_artifacts(self):
        try:
            logger.info(f"Loading ML artifacts from {self.artifacts_dir}...")
            model_path = self.artifacts_dir / "model.joblib"
            scaler_path = self.artifacts_dir / "scaler.joblib"
            encoder_path = self.artifacts_dir / "label_encoder.joblib"
            features_path = self.artifacts_dir / "features.json"
            metrics_path = self.artifacts_dir / "metrics.json"

            if not all(p.exists() for p in [model_path, scaler_path, encoder_path, features_path]):
                logger.warning("Artifact files not found in artifacts dir. Running train.py...")
                from ml.train import train_and_evaluate
                train_and_evaluate(artifacts_dir=str(self.artifacts_dir))

            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            self.label_encoder = joblib.load(encoder_path)

            with open(features_path, "r") as f:
                self.feature_names = json.load(f)

            if metrics_path.exists():
                with open(metrics_path, "r") as f:
                    self.metrics = json.load(f)

            logger.info(f"Successfully loaded model with {len(self.feature_names)} features.")
        except Exception as e:
            logger.error(f"Error loading ML artifacts: {e}", exc_info=True)
            raise RuntimeError(f"Could not initialize ML predictor: {e}")

    def validate_columns(self, input_columns: List[str]) -> None:
        """
        Validates that incoming columns match the training feature list exactly.
        Raises 422 if there is any mismatch.
        """
        input_set = set(c.strip() for c in input_columns)
        expected_set = set(self.feature_names)

        missing = expected_set - input_set
        extra = input_set - expected_set

        if missing or extra:
            detail_msgs = []
            if missing:
                detail_msgs.append(f"Missing {len(missing)} required features: {sorted(list(missing))[:5]}")
            if extra:
                detail_msgs.append(f"Unexpected extra {len(extra)} columns: {sorted(list(extra))[:5]}")
            error_message = (
                f"Feature schema mismatch. Input features must match the {len(self.feature_names)} "
                f"CICIDS2017 training features exactly. " + " ".join(detail_msgs)
            )
            logger.warning(f"Feature validation failed: {error_message}")
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Feature Schema Mismatch",
                    "message": error_message,
                    "missing_features": sorted(list(missing)),
                    "unexpected_features": sorted(list(extra)),
                    "expected_features_count": len(self.feature_names),
                },
            )

    def compute_top_contributions(
        self,
        scaled_row: np.ndarray,
        predicted_idx: int,
        top_k: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Computes top contributing features for the prediction by weighting
        the magnitude of standardized deviation with model feature importances.
        """
        importances = getattr(self.model, "feature_importances_", None)
        if importances is None:
            importances = np.ones(len(self.feature_names)) / len(self.feature_names)

        # Contribution magnitude = |scaled_deviation| * global_importance
        abs_scaled = np.abs(scaled_row)
        contribution_scores = abs_scaled * importances

        # Top k indices
        top_indices = np.argsort(contribution_scores)[::-1][:top_k]

        contributions = []
        for idx in top_indices:
            feat_name = self.feature_names[idx]
            z_score = float(round(scaled_row[idx], 2))
            imp = float(round(importances[idx], 3))

            direction = "elevated" if z_score > 0 else "suppressed"
            contributions.append({
                "feature": feat_name,
                "value": float(round(abs(scaled_row[idx]), 2)),
                "importance": imp,
                "deviation": z_score,
                "importance_weight": imp,
                "standardized_z_score": z_score,
                "direction": direction,
                "impact": f"{direction.capitalize()} ({abs(z_score):.1f} std deviations)",
            })

        return contributions

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts classification for a single flow feature dictionary.
        """
        # Validate columns
        self.validate_columns(list(features.keys()))

        # Build single-row DataFrame with exact feature order
        ordered_data = {col: [features[col]] for col in self.feature_names}
        df = pd.DataFrame(ordered_data)

        # Scale
        scaled_matrix = self.scaler.transform(df)
        scaled_row = scaled_matrix[0]

        # Probabilities & Prediction
        probabilities = self.model.predict_proba(scaled_matrix)[0]
        pred_idx = int(np.argmax(probabilities))
        confidence = float(probabilities[pred_idx])
        label = str(self.label_encoder.inverse_transform([pred_idx])[0])

        # Top contributing features
        top_features = self.compute_top_contributions(scaled_row, pred_idx)

        return {
            "prediction": label,
            "confidence": round(confidence, 4),
            "is_anomaly": label != "BENIGN",
            "top_contributing_features": top_features,
            "probabilities": {
                str(cls_name): round(float(prob), 4)
                for cls_name, prob in zip(self.label_encoder.classes_, probabilities)
            },
        }

    def predict_dataframe(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Batch prediction over a DataFrame.
        """
        # Strip column names
        df_clean = df.copy()
        df_clean.columns = df_clean.columns.str.strip()

        # Validate columns against training features
        self.validate_columns([c for c in df_clean.columns if c in self.feature_names or c not in ["Source IP", "Destination IP", "Protocol", "Label", "label", "src_ip", "dst_ip"]])

        # Extract features in expected order
        X = df_clean[self.feature_names].copy()
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)

        scaled_matrix = self.scaler.transform(X)
        proba_matrix = self.model.predict_proba(scaled_matrix)
        pred_indices = np.argmax(proba_matrix, axis=1)
        labels = self.label_encoder.inverse_transform(pred_indices)

        results = []
        for i in range(len(df_clean)):
            pred_idx = pred_indices[i]
            conf = float(proba_matrix[i][pred_idx])
            lbl = str(labels[i])
            top_feats = self.compute_top_contributions(scaled_matrix[i], pred_idx)

            results.append({
                "row_index": i,
                "prediction": lbl,
                "confidence": round(conf, 4),
                "is_anomaly": lbl != "BENIGN",
                "top_contributing_features": top_feats,
            })

        return results


def get_predictor() -> Predictor:
    return Predictor()
