import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-model"))
from validate_remediation import validate, wilson


class IndependentValidationTests(unittest.TestCase):
    def test_committed_outputs_and_operating_cost(self):
        result = validate(ROOT / "ai-model")
        self.assertEqual(result["test_rows"], 6057)
        self.assertEqual(result["test_alerts"], 4310)
        self.assertEqual(result["metrics_recomputed"]["false_positive"], 2861)
        self.assertGreater(result["average_precision"], result["test_prevalence"])
        self.assertLess(result["metrics_recomputed"]["brier_score"], result["training_prevalence_constant_brier"])

    def test_intervals_have_sensible_edges(self):
        low, high = wilson(0, 100)
        self.assertAlmostEqual(low, 0)
        self.assertGreater(high, 0)
        low, high = wilson(100, 100)
        self.assertAlmostEqual(high, 1)
        self.assertLess(low, 1)


if __name__ == "__main__":
    unittest.main()
