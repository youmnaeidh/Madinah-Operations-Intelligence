"""Re-run the historical implementation and both controlled corrections in isolation."""

import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

from train_sla_risk_model import ROOT

BASELINE = "ed3ab0aeea07fdc21623fd761c6dce376fda2105"


def compare_runs(legacy_dir, cutoff_dir, final_dir):
    def read(path):
        return json.loads((Path(path) / "model_metrics.json").read_text())
    return {"baseline_commit": BASELINE, "legacy": read(legacy_dir),
            "label_cutoff_only_with_unverified_capacity": read(cutoff_dir),
            "final_without_unverified_capacity": read(final_dir),
            "interpretation": [
                "The same two classifier families, seed and validation selection rule are used.",
                "645 resolved labels are excluded from their original cohorts because they were not available at that cohort cutoff.",
                "Final model additionally excludes four staffing features lacking point-in-time availability evidence.",
                "Test cohort is unchanged at 6057 resolved reports; it is a retrospective evaluation conditional on resolution.",
                "Full-precision export is a separate numerical correction; it does not change a fitted model's decisions."]}


def main(output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    source = subprocess.check_output(["git", "show", BASELINE + ":ai-model/train_sla_risk_model.py"], cwd=ROOT, text=True)
    historical_path = output_dir / "historical_trainer.py"
    historical_path.write_text(source)
    spec = importlib.util.spec_from_file_location("historical_trainer", historical_path)
    historical = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(historical)
    historical.ROOT, historical.DATA_DIR, historical.OUT_DIR = ROOT, ROOT / "data", output_dir / "legacy"
    historical.main()
    command = [sys.executable, str(ROOT / "ai-model/train_sla_risk_model.py")]
    subprocess.run(command + ["--output-dir", str(output_dir / "cutoff"), "--include-unverified-capacity"], check=True)
    subprocess.run(command + ["--output-dir", str(output_dir / "final")], check=True)
    comparison = compare_runs(output_dir / "legacy", output_dir / "cutoff", output_dir / "final")
    (output_dir / "validation-comparison.json").write_text(json.dumps(comparison, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True, help="Scratch directory, outside ai-model/")
    args = parser.parse_args()
    if args.output_dir.resolve().is_relative_to((ROOT / "ai-model").resolve()):
        parser.error("Use a scratch directory outside ai-model/")
    main(args.output_dir.resolve())
