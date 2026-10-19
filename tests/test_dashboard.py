import importlib.util
from pathlib import Path
import re
import sys
import unittest

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-model"))
spec = importlib.util.spec_from_file_location("dashboard_audit", ROOT / "ai-model/audit_dashboard.py")
dashboard_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dashboard_audit)


class DashboardReconciliationTests(unittest.TestCase):
    def test_status_capacity_and_sla_denominators(self):
        report = dashboard_audit.audit()
        self.assertEqual(report["source_rows"], sum(report["status_counts"].values()))
        self.assertEqual(report["active_reports"], report["status_counts"]["Open"] + report["status_counts"]["In Progress"])
        self.assertEqual(report["sla_met_resolved"] + report["sla_breached_resolved"], report["status_counts"]["Resolved"])
        self.assertEqual(report["nominal_incident_capacity"], 356984)
        self.assertAlmostEqual(report["demand_over_nominal_capacity"], 30000 / 356984)
        self.assertEqual(sum(x["reports"] for x in report["by_district"]), 30000)
        self.assertEqual(sum(x["nominal_capacity"] for x in report["by_district"]), 356984)
        self.assertFalse(report["legacy_scenario_only"]["validated"])

    def test_portable_query_schemas_match_every_csv(self):
        # Static schema coverage, not an assertion that M has executed in Desktop.
        for folder in ["data", "ai-model"]:
            for source in (ROOT / folder).glob("*.csv"):
                with self.subTest(source=source.name):
                    query = (ROOT / "power-query" / (source.stem + ".pq")).read_text()
                    declarations = re.findall(r'\{"([A-Za-z0-9_]+)", (?:type \w+|Int64.Type)\}', query)
                    self.assertEqual(declarations, pd.read_csv(source, nrows=0).columns.tolist())
                    self.assertIn(source.relative_to(ROOT).as_posix(), query)


if __name__ == "__main__":
    unittest.main()
