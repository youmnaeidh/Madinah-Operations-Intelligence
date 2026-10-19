import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-model"))
spec = importlib.util.spec_from_file_location("model", ROOT / "ai-model/train_sla_risk_model.py")
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)


class ModelContractTests(unittest.TestCase):
    def test_labels_resolved_at_or_after_decision_cutoff_are_purged(self):
        frame = pd.DataFrame({
            "CreatedAt": pd.to_datetime(["2026-01-01", "2026-01-31", "2026-02-01", "2026-02-28", "2026-03-01"]),
            "ResolvedAt": pd.to_datetime(["2026-01-02", "2026-02-01", "2026-02-02", "2026-03-01", "2026-03-02"]),
            "Status": ["Resolved"] * 5,
        })
        masks = model.temporal_masks(frame)
        self.assertEqual(np.flatnonzero(masks["Train"]).tolist(), [0])
        self.assertEqual(np.flatnonzero(masks["Validation"]).tolist(), [2])
        self.assertEqual(np.flatnonzero(masks["Test"]).tolist(), [4])

    def test_source_splits_and_feature_availability_contract(self):
        incidents, features, _, numeric = model.prepare_data()
        masks = model.temporal_masks(incidents)
        self.assertEqual({k: int(v.sum()) for k, v in masks.items()},
                         {"Train": 18548, "Validation": 4483, "Test": 6057})
        excluded = set(model.CAPACITY_FEATURES + ["ResponseHours", "AssignmentDelayHours", "AssignedAt",
                       "ResolvedAt", "ResolutionHours", "SLAMet", "Status", "WasReopened", "SatisfactionScore"])
        self.assertFalse(set(features) & excluded)
        self.assertEqual(len(features), 30000)
        self.assertTrue(all(np.isfinite(features[numeric]).all()))

    def test_export_roundtrips_adjacent_float_threshold_boundaries(self):
        probabilities = np.array([np.nextafter(.27, 0), .27, np.nextafter(.25, 0),
                                  .25, np.nextafter(.4, 0), .4])
        frame = pd.DataFrame({"PredictedBreachProbability": probabilities,
                              "PredictedBreach": (probabilities >= .27).astype(int),
                              "RiskBand": model.risk_bands(probabilities)})
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "scores.csv"
            model.write_predictions(frame, path, .27)
            loaded = pd.read_csv(path, float_precision="round_trip")
            np.testing.assert_array_equal(probabilities, loaded.PredictedBreachProbability)
            self.assertEqual(loaded.PredictedBreach.tolist()[:2], [0, 1])
            self.assertEqual(loaded.RiskBand.tolist()[2:], ["Low", "Moderate", "Moderate", "High"])

    def test_preprocessor_is_fitted_on_training_data_only(self):
        preprocessor = model.make_preprocessor(["category"], ["number"])
        train = pd.DataFrame({"category": ["known", "known"], "number": [1., 3.]})
        preprocessor.fit(train)
        before = preprocessor.named_transformers_["numeric"].named_steps["imputer"].statistics_.copy()
        transformed = preprocessor.transform(pd.DataFrame({"category": ["future"], "number": [np.nan]}))
        np.testing.assert_array_equal(before, [2.])
        np.testing.assert_array_equal(preprocessor.named_transformers_["numeric"].named_steps["imputer"].statistics_, before)
        self.assertTrue(np.isfinite(transformed).all())


if __name__ == "__main__":
    unittest.main()
