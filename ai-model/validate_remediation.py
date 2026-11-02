"""Independent export reconciliation; no model fitting or report-engine claims."""
import argparse
import hashlib
import json
import importlib.metadata
import platform
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss

from train_sla_risk_model import ROOT, classification_metrics, prepare_data, temporal_masks


def wilson(successes, total):
    z = 1.959963984540054
    p = successes / total
    denominator = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denominator
    half = z * np.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return [float(centre - half), float(centre + half)]


def validate(export_dir, reference_dir=None):
    export_dir = Path(export_dir)
    metrics = json.loads((export_dir / "model_metrics.json").read_text(encoding="utf-8"))
    scores = pd.read_csv(export_dir / "incident_ai_predictions.csv", float_precision="round_trip")
    incidents, _, _, _ = prepare_data()
    masks = temporal_masks(incidents)
    if not scores.IncidentID.equals(incidents.IncidentID):
        raise ValueError("Prediction IDs must match source rows exactly once and in order")
    for column in ["DateKey", "DistrictKey", "CategoryKey", "ChannelKey", "Hour", "Priority", "Status"]:
        if not scores[column].equals(incidents[column]):
            raise ValueError(f"Prediction/source mismatch: {column}")
    if not pd.to_datetime(scores.CreatedAt).equals(incidents.CreatedAt):
        raise ValueError("Prediction/source timestamp mismatch")
    for filename, expected in metrics["source_sha256"].items():
        if hashlib.sha256((ROOT / "data" / filename).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Source hash mismatch: {filename}")
    y = incidents.loc[masks["Test"], "BreachFlag"].astype(int).to_numpy()
    p = scores.loc[masks["Test"], "PredictedBreachProbability"].to_numpy()
    actual = classification_metrics(y, p, metrics["decision_threshold"])
    for name, value in actual.items():
        np.testing.assert_allclose(value, metrics["test_metrics"][name], rtol=0, atol=1e-12)
    training_prevalence = float(incidents.loc[masks["Train"], "BreachFlag"].mean())
    result = {
        "source_rows": len(incidents), "test_rows": len(y),
        "source_hashes": "matched", "prediction_source_metadata": "matched",
        "runtime": {"python": platform.python_version(), **{name: importlib.metadata.version(name) for name in ["numpy", "pandas", "scikit-learn", "joblib", "scipy", "threadpoolctl"]}},
        "metrics_recomputed": actual,
        "test_alerts": actual["true_positive"] + actual["false_positive"],
        "test_alert_rate": float(np.mean(p >= metrics["decision_threshold"])),
        "test_prevalence": float(y.mean()),
        "average_precision": float(average_precision_score(y, p)),
        "training_prevalence_constant_brier": float(brier_score_loss(y, np.full(len(y), training_prevalence))),
        "recall_wilson_95": wilson(actual["true_positive"], actual["true_positive"] + actual["false_negative"]),
        "precision_wilson_95": wilson(actual["true_positive"], actual["true_positive"] + actual["false_positive"]),
        "uncertainty_scope": "Row-level descriptive binomial intervals; not adjusted for repeated-location/time dependence or threshold/model selection.",
        "calibration_scope": "Brier comparison does not prove calibration; retain score/risk language and human review.",
        "desktop_verified": False,
    }
    if reference_dir is not None:
        reference_dir = Path(reference_dir)
        comparisons = {}
        keys = {"incident_ai_predictions.csv": ["IncidentID"],
                "district_ai_summary.csv": ["DistrictKey"],
                "feature_importance.csv": ["Feature"],
                "feature_group_importance.csv": ["FeatureGroup"],
                "model_performance.csv": ["Model", "Dataset", "Metric"]}
        for name in ["incident_ai_predictions.csv", "district_ai_summary.csv", "feature_importance.csv", "feature_group_importance.csv", "model_performance.csv"]:
            current = pd.read_csv(export_dir / name, float_precision="round_trip")
            reference = pd.read_csv(reference_dir / name, float_precision="round_trip")
            for frame in [current, reference]:
                if frame.duplicated(keys[name]).any():
                    raise ValueError(f"Duplicate export key: {name}")
            current = current.sort_values(keys[name]).reset_index(drop=True)
            reference = reference.sort_values(keys[name]).reset_index(drop=True)
            same = True
            differences = []
            try:
                pd.testing.assert_frame_equal(current, reference, check_exact=False, rtol=1e-12, atol=1e-14)
            except AssertionError:
                # Native tree split ties may attribute an identical split to
                # either of two perfectly collinear inputs across platforms.
                # Do not hide this behind a large tolerance. Scores, metrics,
                # district totals and GROUPED importances still must match.
                if name != "feature_importance.csv":
                    raise
                pd.testing.assert_series_equal(current.Feature, reference.Feature)
                same = False
                for row, old in zip(current.itertuples(), reference.itertuples()):
                    if abs(row.Importance - old.Importance) > 1e-12:
                        differences.append({"feature": row.Feature, "rerun_importance": row.Importance,
                                            "committed_importance": old.Importance})
            comparisons[name] = {"numeric_and_text_equal": same,
                                 "byte_equal": (export_dir / name).read_bytes() == (reference_dir / name).read_bytes(),
                                 "individual_attribution_differences": differences}
        result["reference_comparison"] = comparisons
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-dir", type=Path, default=ROOT / "ai-model")
    parser.add_argument("--reference-dir", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    payload = json.dumps(validate(args.export_dir, args.reference_dir), indent=2) + "\n"
    if args.output:
        args.output.write_text(payload, encoding="utf-8", newline="\n")
    else:
        print(payload, end="")
