import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("quality", ROOT / "ai-model/data_quality.py")
quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)


class SourceQualityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tables = quality.load_source_tables(ROOT / "data")

    def test_historical_data_and_visual_assets_unchanged(self):
        manifest = json.loads((ROOT / "documentation/source-asset-manifest.json").read_text())
        for name, expected in manifest.items():
            with self.subTest(path=name):
                self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected)

    def test_assignment_delay_uses_timestamps_and_preserves_response(self):
        frame = pd.DataFrame({"CreatedAt": ["2026-01-01 00:00:00"],
                              "AssignedAt": ["2026-01-01 01:30:00"],
                              "ResponseHours": [9.5]})
        self.assertEqual(quality.assignment_delay_hours(frame).iloc[0], 1.5)
        self.assertEqual(frame.ResponseHours.iloc[0], 9.5)
        frame.loc[0, "AssignedAt"] = "2025-12-31 23:59:59"
        with self.assertRaisesRegex(ValueError, "ordered"):
            quality.assignment_delay_hours(frame)

    def test_duplicate_dimension_rejected_before_join(self):
        tables = dict(self.tables)
        tables["DimDistrict"] = pd.concat([tables["DimDistrict"], tables["DimDistrict"].iloc[:1]])
        with self.assertRaisesRegex(ValueError, "unique"):
            quality.validate_source_tables(tables)

    def test_missing_capacity_rejected(self):
        tables = dict(self.tables)
        tables["FactDailyCapacity"] = tables["FactDailyCapacity"].iloc[1:]
        with self.assertRaisesRegex(ValueError, "Missing.*capacity"):
            quality.validate_source_tables(tables)

    def test_invalid_label_and_timestamp_rejected(self):
        tables = dict(self.tables)
        tables["FactIncidents"] = tables["FactIncidents"].copy()
        tables["FactIncidents"].loc[0, "SLAMet"] = not tables["FactIncidents"].loc[0, "SLAMet"]
        with self.assertRaisesRegex(ValueError, "SLA result"):
            quality.validate_source_tables(tables)


if __name__ == "__main__":
    unittest.main()
