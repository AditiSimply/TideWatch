"""
ml/make_demo_sample.py
──────────────────────
Builds a balanced 5,000-row demo CSV that the SSE stream replays and the
frontend Analyze page uses as a drag-and-drop test file.

The feature distribution mirrors CICIDS2017 statistics so that the trained
model produces realistic predictions without needing the real dataset.

Usage:
    python ml/make_demo_sample.py                        # → artifacts/test_samples.csv
    python ml/make_demo_sample.py --out my_sample.csv   # custom output path
    python ml/make_demo_sample.py --rows 1000           # smaller file
"""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd


# ── Feature distribution per class (mean, std) calibrated to CICIDS2017 ────────

ATTACK_PROFILES = {
    "BENIGN": {
        "Flow Duration": (1_200_000, 800_000),
        "Total Fwd Packets": (12.0, 8.0),
        "Total Backward Packets": (10.0, 7.0),
        "Total Length of Fwd Packets": (4200.0, 3200.0),
        "Total Length of Bwd Packets": (3800.0, 2900.0),
        "Fwd Packet Length Max": (1400.0, 280.0),
        "Fwd Packet Length Min": (40.0, 20.0),
        "Fwd Packet Length Mean": (350.0, 160.0),
        "Fwd Packet Length Std": (420.0, 180.0),
        "Bwd Packet Length Max": (1400.0, 280.0),
        "Bwd Packet Length Min": (40.0, 20.0),
        "Bwd Packet Length Mean": (350.0, 160.0),
        "Bwd Packet Length Std": (420.0, 180.0),
        "Flow Bytes/s": (15_000.0, 8_000.0),
        "Flow Packets/s": (120.0, 80.0),
        "Flow IAT Mean": (8500.0, 4000.0),
        "Flow IAT Std": (12000.0, 7000.0),
        "Flow IAT Max": (120_000.0, 80_000.0),
        "Flow IAT Min": (80.0, 40.0),
        "Fwd IAT Total": (1_100_000.0, 700_000.0),
        "Fwd IAT Mean": (9000.0, 4500.0),
        "Fwd IAT Std": (13000.0, 7000.0),
        "Fwd IAT Max": (130_000.0, 85_000.0),
        "Fwd IAT Min": (85.0, 42.0),
        "Bwd IAT Total": (1_000_000.0, 650_000.0),
        "Bwd IAT Mean": (8800.0, 4200.0),
        "Bwd IAT Std": (12500.0, 6500.0),
        "Bwd IAT Max": (125_000.0, 80_000.0),
        "Bwd IAT Min": (82.0, 40.0),
        "Fwd PSH Flags": (0.1, 0.1),
        "Bwd PSH Flags": (0.0, 0.0),
        "Fwd URG Flags": (0.0, 0.0),
        "Bwd URG Flags": (0.0, 0.0),
        "Fwd Header Length": (160.0, 60.0),
        "Bwd Header Length": (140.0, 55.0),
        "Fwd Packets/s": (60.0, 40.0),
        "Bwd Packets/s": (55.0, 38.0),
        "Min Packet Length": (40.0, 18.0),
        "Max Packet Length": (1400.0, 280.0),
        "Packet Length Mean": (350.0, 140.0),
        "Packet Length Std": (420.0, 180.0),
        "Packet Length Variance": (176_400.0, 100_000.0),
        "FIN Flag Count": (0.8, 0.3),
        "SYN Flag Count": (1.0, 0.2),
        "RST Flag Count": (0.05, 0.05),
        "PSH Flag Count": (4.5, 3.0),
        "ACK Flag Count": (18.0, 10.0),
        "URG Flag Count": (0.0, 0.0),
        "CWE Flag Count": (0.0, 0.0),
        "ECE Flag Count": (0.0, 0.0),
        "Down/Up Ratio": (0.9, 0.2),
        "Average Packet Size": (350.0, 140.0),
        "Avg Fwd Segment Size": (350.0, 160.0),
        "Avg Bwd Segment Size": (350.0, 155.0),
        "Fwd Header Length.1": (160.0, 60.0),
        "Fwd Avg Bytes/Bulk": (0.0, 0.0),
        "Fwd Avg Packets/Bulk": (0.0, 0.0),
        "Fwd Avg Bulk Rate": (0.0, 0.0),
        "Bwd Avg Bytes/Bulk": (0.0, 0.0),
        "Bwd Avg Packets/Bulk": (0.0, 0.0),
        "Bwd Avg Bulk Rate": (0.0, 0.0),
        "Subflow Fwd Packets": (12.0, 8.0),
        "Subflow Fwd Bytes": (4200.0, 3200.0),
        "Subflow Bwd Packets": (10.0, 7.0),
        "Subflow Bwd Bytes": (3800.0, 2900.0),
        "Init_Win_bytes_forward": (29000.0, 3000.0),
        "Init_Win_bytes_backward": (28500.0, 3100.0),
        "act_data_pkt_fwd": (8.0, 5.0),
        "min_seg_size_forward": (20.0, 5.0),
        "Active Mean": (200_000.0, 150_000.0),
        "Active Std": (180_000.0, 130_000.0),
        "Active Max": (500_000.0, 300_000.0),
        "Active Min": (50_000.0, 35_000.0),
        "Idle Mean": (2_500_000.0, 1_500_000.0),
        "Idle Std": (2_200_000.0, 1_200_000.0),
        "Idle Max": (6_000_000.0, 3_000_000.0),
        "Idle Min": (800_000.0, 500_000.0),
    },
    "DDoS": {
        "Flow Duration": (18200.0, 5000.0),
        "Flow Packets/s": (34430.0, 8000.0),
        "Flow IAT Mean": (28.4, 10.0),
        "Flow IAT Std": (42.0, 15.0),
        "Init_Win_bytes_forward": (29200.0, 200.0),
        "SYN Flag Count": (1.0, 0.1),
        "ACK Flag Count": (1.0, 0.1),
    },
    "DoS": {
        "Flow Duration": (32000.0, 10000.0),
        "Flow Packets/s": (22000.0, 6000.0),
        "Flow IAT Mean": (45.0, 15.0),
        "SYN Flag Count": (1.0, 0.1),
        "ACK Flag Count": (1.0, 0.1),
    },
    "PortScan": {
        "Flow Duration": (350.0, 120.0),
        "Total Fwd Packets": (1.0, 0.1),
        "Total Backward Packets": (1.0, 0.2),
        "Flow Packets/s": (8200.0, 2000.0),
        "SYN Flag Count": (1.0, 0.1),
        "RST Flag Count": (1.0, 0.2),
    },
    "BruteForce": {
        "Flow Duration": (180_000.0, 60_000.0),
        "Total Fwd Packets": (25.0, 12.0),
        "Total Backward Packets": (22.0, 10.0),
        "Flow Packets/s": (420.0, 200.0),
        "FIN Flag Count": (1.0, 0.2),
        "SYN Flag Count": (1.0, 0.1),
    },
}

# Metadata columns (not model features)
META_COLS = {
    "Source IP": lambda i, rng: f"192.168.{rng.integers(1, 21)}.{rng.integers(1, 255)}",
    "Destination IP": lambda i, rng: "192.168.10.1",
    "Protocol": lambda i, rng: rng.choice(["TCP", "UDP"]),
    "Destination Port": lambda i, rng: int(rng.choice([80, 443, 22, 3389, 8080, 8443])),
}

ATTACK_SOURCE_IPS = {
    "DDoS": "205.174.165.73",
    "DoS": "172.16.0.1",
    "PortScan": "192.168.10.51",
    "BruteForce": "45.33.32.156",
}

CLASS_WEIGHTS = {
    "BENIGN": 0.40,
    "DDoS": 0.20,
    "DoS": 0.15,
    "PortScan": 0.15,
    "BruteForce": 0.10,
}


def _generate_row(label: str, idx: int, feature_names: list, rng: np.random.Generator) -> dict:
    profile = ATTACK_PROFILES.get(label, ATTACK_PROFILES["BENIGN"])
    benign_profile = ATTACK_PROFILES["BENIGN"]

    row = {}
    for feat in feature_names:
        if feat in profile:
            mean, std = profile[feat]
        elif feat in benign_profile:
            mean, std = benign_profile[feat]
        else:
            mean, std = 0.0, 1.0
        val = max(0.0, float(rng.normal(mean, std)))
        row[feat] = round(val, 4)

    # Metadata
    if label in ATTACK_SOURCE_IPS:
        row["Source IP"] = ATTACK_SOURCE_IPS[label]
    else:
        row["Source IP"] = f"192.168.{rng.integers(1, 21)}.{rng.integers(1, 255)}"
    row["Destination IP"] = "192.168.10.1"
    row["Protocol"] = rng.choice(["TCP", "UDP"])  # type: ignore[arg-type]
    row["Destination Port"] = int(rng.choice([80, 443, 22, 3389, 8080]))
    row["Label"] = label
    return row


def make_demo_sample(
    output_path: str = "artifacts/test_samples.csv",
    n_rows: int = 5_000,
    seed: int = 42,
) -> Path:
    """
    Generate a demo sample CSV and write it to output_path.
    Returns the resolved Path.
    """
    # Load feature list from artifacts if present
    artifacts_dir = Path(output_path).parent
    features_path = artifacts_dir / "features.json"

    if features_path.exists():
        feature_names = json.loads(features_path.read_text())
        print(f"[make_demo_sample] Loaded {len(feature_names)} features from {features_path}")
    else:
        # Fall back to BENIGN profile keys
        feature_names = list(ATTACK_PROFILES["BENIGN"].keys())
        print(f"[make_demo_sample] features.json not found — using {len(feature_names)} default features")

    rng = np.random.default_rng(seed)
    classes = list(CLASS_WEIGHTS.keys())
    weights = [CLASS_WEIGHTS[c] for c in classes]

    rows = []
    for i in range(n_rows):
        label = rng.choice(classes, p=weights)  # type: ignore[arg-type]
        rows.append(_generate_row(label, i, feature_names, rng))

    df = pd.DataFrame(rows)
    # Shuffle
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)

    label_counts = df["Label"].value_counts().to_dict()
    print(f"[make_demo_sample] Written {len(df):,} rows → {out}")
    for lbl, cnt in label_counts.items():
        print(f"  {lbl}: {cnt} rows ({100 * cnt / len(df):.1f}%)")

    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Tidewatch demo sample CSV")
    parser.add_argument("--out", default="artifacts/test_samples.csv", help="Output CSV path")
    parser.add_argument("--rows", type=int, default=5_000, help="Number of rows to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()
    make_demo_sample(output_path=args.out, n_rows=args.rows, seed=args.seed)
