"""Check persisted scores against the fitted model and independently reaggregate KPIs."""

import argparse
import importlib.metadata
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from train_sla_risk_model import (OUT_DIR, ROOT, classification_metrics,
                                prepare_data, risk_bands, temporal_masks)


def verify(output_dir=OUT_DIR):
    output_dir = Path(output_dir)
    metrics = json.loads((output_dir / "model_metrics.json").read_text())
    predictions = pd.read_csv(output_dir / "incident_ai_predictions.csv", float_precision="round_trip")
    incidents, features, categorical, numeric = prepare_data()
    bundle = joblib.load(output_dir / "sla_risk_model.pkl")
    assert not metrics["include_unverified_capacity"], "Diagnostic model must not replace final exports"
    assert metrics["feature_columns"] == categorical + numeric
    assert predictions.IncidentID.is_unique and predictions.IncidentID.equals(incidents.IncidentID)
    score = predictions.PredictedBreachProbability.to_numpy()
    assert np.isfinite(score).all() and ((score >= 0) & (score <= 1)).all()
    np.testing.assert_array_equal(bundle["pipeline"].predict_proba(features)[:, 1], score)
    threshold = metrics["decision_threshold"]
    assert threshold == bundle["decision_threshold"]
    np.testing.assert_array_equal(predictions.PredictedBreach, (score >= threshold).astype(int))
    np.testing.assert_array_equal(predictions.RiskBand, risk_bands(score))
    masks = temporal_masks(incidents)
    for name, mask in masks.items():
        np.testing.assert_array_equal(predictions.ModelSplit.eq(name), mask)
    np.testing.assert_allclose(predictions.ActualBreach, incidents.BreachFlag, equal_nan=True)
    assert predictions.loc[predictions.Status.ne("Resolved"), "ActualBreach"].isna().all()
    measured = classification_metrics(predictions.loc[masks["Test"], "ActualBreach"], score[masks["Test"]], threshold)
    for name, value in measured.items():
        np.testing.assert_allclose(value, metrics["test_metrics"][name], rtol=0, atol=1e-15)
    summary = pd.read_csv(output_dir / "district_ai_summary.csv", float_precision="round_trip").set_index("DistrictKey")
    actual_summary = predictions.groupby("DistrictKey").PredictedBreachProbability.mean()
    np.testing.assert_allclose(summary.loc[actual_summary.index, "AveragePredictedRisk"], actual_summary, rtol=0, atol=1e-15)
    assert int(summary.TotalReports.sum()) == 30000
    for name in ["Open", "In Progress", "Active"]:
        mask = predictions.Status.eq(name) if name != "Active" else predictions.Status.isin(["Open", "In Progress"])
        key = name.lower().replace(" ", "_")
        assert int((mask & predictions.RiskBand.eq("High")).sum()) == metrics["high_risk_count_" + key]
    for line in (ROOT / "requirements.txt").read_text().splitlines():
        if line.strip() and not line.startswith("#"):
            name, version = line.split("==")
            assert importlib.metadata.version(name) == version, f"Dependency mismatch: {name}"
    return {"rows_checked": len(predictions), "test_rows": int(masks["Test"].sum()),
            "probability_roundtrip_mismatches": 0, "classification_mismatches": 0,
            "risk_band_mismatches": 0, "model_score_mismatches": 0,
            "source_validation": "passed", "dependency_versions": "matched requirements.txt"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    print(json.dumps(verify(args.output_dir), indent=2))
