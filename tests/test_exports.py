import json
from pathlib import Path
import sys
import unittest

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-model"))
from train_sla_risk_model import classification_metrics, risk_bands


class PersistedExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictions = pd.read_csv(ROOT / "ai-model/incident_ai_predictions.csv", float_precision="round_trip")
        cls.metrics = json.loads((ROOT / "ai-model/model_metrics.json").read_text())

    def test_flags_and_bands_from_persisted_full_precision_scores(self):
        p, m = self.predictions, self.metrics
        self.assertEqual(len(p), 30000)
        self.assertTrue(p.IncidentID.is_unique)
        self.assertTrue(p.PredictedBreachProbability.between(0, 1).all())
        np.testing.assert_array_equal(p.PredictedBreach, p.PredictedBreachProbability.ge(m["decision_threshold"]).astype(int))
        np.testing.assert_array_equal(p.RiskBand, risk_bands(p.PredictedBreachProbability))

    def test_test_metrics_recomputed_from_persisted_predictions(self):
        p, m = self.predictions, self.metrics
        mask = p.ModelSplit.eq("Test")
        self.assertEqual(int(mask.sum()), m["row_counts"]["testing"])
        measured = classification_metrics(p.loc[mask, "ActualBreach"], p.loc[mask, "PredictedBreachProbability"], m["decision_threshold"])
        for key, value in measured.items():
            self.assertAlmostEqual(value, m["test_metrics"][key], places=14)
        self.assertTrue(p.loc[p.Status.ne("Resolved"), "ActualBreach"].isna().all())

    def test_source_population_and_risk_counts_reconcile(self):
        p = self.predictions
        source = pd.read_csv(ROOT / "data/FactIncidents.csv")
        self.assertEqual(p.IncidentID.tolist(), source.IncidentID.tolist())
        self.assertEqual(p.Status.tolist(), source.Status.tolist())
        self.assertEqual(p.Status.value_counts().to_dict(), {"Resolved": 29733, "In Progress": 265, "Open": 2})
        active = p.Status.isin(["Open", "In Progress"])
        self.assertEqual(int((active & p.RiskBand.eq("High")).sum()), self.metrics["high_risk_count_active"])
        self.assertEqual(self.metrics["high_risk_count_active"], self.metrics["high_risk_count_open"] + self.metrics["high_risk_count_in_progress"])


if __name__ == "__main__":
    unittest.main()
