"""Train and export an availability-aware synthetic SLA breach risk model.

Uses scikit-learn Pipelines so preprocessing learned from the training period
is applied consistently to validation, test, and active synthetic reports.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import AdaBoostClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, brier_score_loss, confusion_matrix,
                             f1_score, precision_score, recall_score, roc_auc_score)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

from data_quality import load_source_tables

SEED = 42
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_DIR = Path(__file__).resolve().parent
TRAIN_CUTOFF = pd.Timestamp("2026-02-01")
VALIDATION_CUTOFF = pd.Timestamp("2026-03-01")
SNAPSHOT_CUTOFF = pd.Timestamp("2026-04-06")
CAPACITY_FEATURES = ["PlannedTeams", "AvailableTeams", "IncidentCapacity", "AvailabilityRatio"]


def classification_metrics(y_true, probabilities, threshold):
    predictions = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predictions, labels=[0, 1]).ravel()
    specificity = tn / (tn + fp) if tn + fp else 0.0
    return {
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "accuracy": float(accuracy_score(y_true, predictions)),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall": float(recall_score(y_true, predictions, zero_division=0)),
        "specificity": float(specificity),
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "true_positive": int(tp), "true_negative": int(tn),
        "false_positive": int(fp), "false_negative": int(fn),
    }


def choose_threshold(y_true, probabilities):
    """Maximize validation F1 among thresholds with at least 70% recall."""
    scored = []
    for threshold in np.round(np.arange(0.20, 0.801, 0.01), 2):
        metrics = classification_metrics(y_true, probabilities, float(threshold))
        scored.append((metrics["f1"], metrics["recall"], float(threshold)))
    eligible = [row for row in scored if row[1] >= 0.70]
    selected = max(eligible or scored, key=lambda row: (row[0], row[1], -row[2]))
    return round(selected[2], 2)


def prepare_data(include_unverified_capacity=False):
    tables = load_source_tables(DATA_DIR)
    incidents = tables["FactIncidents"].copy()
    districts, categories = tables["DimDistrict"], tables["DimCategory"]
    channels, times = tables["DimChannel"], tables["DimTime"]
    capacity = tables["FactDailyCapacity"]

    incidents["CreatedAt"] = pd.to_datetime(incidents["CreatedAt"], errors="raise")
    incidents["ResolvedAt"] = pd.to_datetime(incidents["ResolvedAt"], errors="raise")
    incidents["SLAMet"] = incidents["SLAMet"].map(
        {True: True, False: False, "True": True, "False": False})
    incidents = incidents.merge(
        districts[["DistrictKey", "DistrictEN", "Sector", "DemandWeight"]],
        on="DistrictKey", how="left", validate="many_to_one")
    incidents = incidents.merge(
        categories[["CategoryKey", "CategoryEN", "Complexity"]],
        on="CategoryKey", how="left", validate="many_to_one")
    incidents = incidents.merge(channels, on="ChannelKey", how="left", validate="many_to_one")
    incidents = incidents.merge(
        times[["Hour", "TimeBand", "Shift"]], on="Hour", how="left", validate="many_to_one")
    incidents = incidents.merge(
        capacity, on=["DateKey", "DistrictKey", "Shift"], how="left", validate="many_to_one")

    incidents["DayOfWeek"] = incidents["CreatedAt"].dt.dayofweek
    incidents["Month"] = incidents["CreatedAt"].dt.month
    incidents["IsWeekend"] = incidents["DayOfWeek"].isin([4, 5]).astype(int)
    incidents["HourSin"] = np.sin(2 * np.pi * incidents["Hour"] / 24)
    incidents["HourCos"] = np.cos(2 * np.pi * incidents["Hour"] / 24)
    incidents["DaySin"] = np.sin(2 * np.pi * incidents["DayOfWeek"] / 7)
    incidents["DayCos"] = np.cos(2 * np.pi * incidents["DayOfWeek"] / 7)
    incidents["AvailabilityRatio"] = (
        incidents["AvailableTeams"] / incidents["PlannedTeams"].replace(0, np.nan))
    incidents["IsRepeatNumeric"] = (
        incidents["IsRepeat"].astype(str).str.lower().eq("true").astype(int))
    incidents["BreachFlag"] = np.where(
        incidents["Status"].eq("Resolved"),
        (~incidents["SLAMet"].fillna(False)).astype(int), np.nan)

    categorical = ["DistrictKey", "Sector", "CategoryKey", "Subcategory",
                   "ChannelKey", "Priority", "Shift", "TimeBand", "Month"]
    numeric = ["SLATargetHours", "DemandWeight", "Complexity",
               "IsWeekend", "IsRepeatNumeric", "HourSin", "HourCos",
               "DaySin", "DayCos"]
    # Daily staffing totals have no point-in-time availability records. This
    # diagnostic option isolates the label-cutoff correction; default exports
    # exclude these fields until their availability at creation is established.
    if include_unverified_capacity:
        numeric = numeric[:3] + CAPACITY_FEATURES + numeric[3:]
    features = incidents[categorical + numeric].copy()
    for column in categorical:
        features[column] = features[column].fillna("Unknown").astype(str)
    for column in numeric:
        features[column] = pd.to_numeric(features[column], errors="coerce")
    return incidents, features, categorical, numeric


def temporal_masks(incidents):
    """A label can influence a decision only after its resolution is recorded."""
    created, resolved_at = incidents["CreatedAt"], incidents["ResolvedAt"]
    resolved = incidents["Status"].eq("Resolved")
    if (created >= SNAPSHOT_CUTOFF).any() or (resolved_at >= SNAPSHOT_CUTOFF).any():
        raise ValueError("Source exceeds the declared snapshot cutoff")
    masks = {
        "Train": resolved & (created < TRAIN_CUTOFF) & (resolved_at < TRAIN_CUTOFF),
        "Validation": (resolved & (created >= TRAIN_CUTOFF)
                       & (created < VALIDATION_CUTOFF) & (resolved_at < VALIDATION_CUTOFF)),
        "Test": (resolved & (created >= VALIDATION_CUTOFF)
                 & (created < SNAPSHOT_CUTOFF) & (resolved_at < SNAPSHOT_CUTOFF)),
    }
    for name, mask in masks.items():
        if not mask.any():
            raise ValueError(f"Empty {name} split")
    return {name: mask.to_numpy() for name, mask in masks.items()}


def risk_bands(probabilities):
    return pd.cut(probabilities, bins=[-np.inf, .25, .40, np.inf],
                  labels=["Low", "Moderate", "High"], right=False).astype(str)


def write_predictions(predictions, path, threshold):
    """Export round-trip binary64 scores; formatting belongs in Power BI."""
    predictions.to_csv(path, index=False, float_format="%.17g")
    reloaded = pd.read_csv(path, float_precision="round_trip")
    if not np.array_equal(reloaded.PredictedBreachProbability.to_numpy(),
                          predictions.PredictedBreachProbability.to_numpy()):
        raise ValueError("Probability precision lost during CSV export")
    if not reloaded.PredictedBreach.eq(
            reloaded.PredictedBreachProbability.ge(threshold).astype(int)).all():
        raise ValueError("Exported flags disagree with exported scores")
    if not np.array_equal(risk_bands(reloaded.PredictedBreachProbability), reloaded.RiskBand):
        raise ValueError("Exported risk bands disagree with exported scores")


def make_preprocessor(categorical, numeric):
    numeric_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    categorical_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    return ColumnTransformer([
        ("numeric", numeric_pipe, numeric),
        ("categorical", categorical_pipe, categorical),
    ], verbose_feature_names_out=False)


def make_models(categorical, numeric):
    return {
        "Logistic Regression": Pipeline([
            ("preprocessor", make_preprocessor(categorical, numeric)),
            ("classifier", LogisticRegression(
                max_iter=2000, class_weight="balanced", random_state=SEED)),
        ]),
        "AdaBoost Decision Stumps": Pipeline([
            ("preprocessor", make_preprocessor(categorical, numeric)),
            ("classifier", AdaBoostClassifier(
                estimator=DecisionTreeClassifier(max_depth=1, random_state=SEED),
                n_estimators=100, learning_rate=0.5, random_state=SEED)),
        ]),
    }


def feature_importance_frame(model):
    preprocessor = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]
    names = preprocessor.get_feature_names_out()
    importance = (np.asarray(classifier.feature_importances_, dtype=float)
                  if hasattr(classifier, "feature_importances_")
                  else np.abs(np.asarray(classifier.coef_[0], dtype=float)))
    frame = pd.DataFrame({"Feature": names, "Importance": importance})
    frame = frame.sort_values("Importance", ascending=False)
    total = float(frame["Importance"].sum())
    frame["ImportanceShare"] = (frame["Importance"] / total).round(6) if total else 0.0
    return frame


def feature_group(feature):
    if feature.startswith("Subcategory_"): return "Subcategory"
    if feature.startswith(("DistrictKey_", "Sector_")) or feature == "DemandWeight": return "Location"
    if feature.startswith("CategoryKey_") or feature in {"Complexity", "SLATargetHours"}: return "Service Category & SLA"
    if feature.startswith("TimeBand_") or feature in {"HourSin", "HourCos"}: return "Time of Day"
    if feature in {"PlannedTeams", "AvailableTeams", "IncidentCapacity", "AvailabilityRatio"}: return "Team Capacity"
    if feature.startswith("Priority_"): return "Priority"
    if feature.startswith("ChannelKey_"): return "Reporting Channel"
    if feature == "IsRepeatNumeric": return "Repeat History"
    return "Calendar Pattern"


def main(output_dir=OUT_DIR, include_unverified_capacity=False):
    output_dir = Path(output_dir)
    if include_unverified_capacity and output_dir.resolve() == OUT_DIR.resolve():
        raise ValueError("Diagnostic capacity runs require a separate --output-dir")
    output_dir.mkdir(parents=True, exist_ok=True)
    incidents, features, categorical, numeric = prepare_data(include_unverified_capacity)
    resolved = incidents["Status"].eq("Resolved").to_numpy()
    masks = temporal_masks(incidents)
    train_mask, validation_mask, test_mask = [masks[name] for name in ["Train", "Validation", "Test"]]
    y_all = incidents["BreachFlag"].fillna(0).astype(int).to_numpy()

    models = make_models(categorical, numeric)
    validation_auc, validation_probabilities = {}, {}
    for name, model in models.items():
        for mask in masks.values():
            if len(np.unique(y_all[mask])) != 2:
                raise ValueError("Each evaluation split must contain both target classes")
        model.fit(features.loc[train_mask], y_all[train_mask])
        probability = model.predict_proba(features.loc[validation_mask])[:, 1]
        validation_probabilities[name] = probability
        validation_auc[name] = float(roc_auc_score(y_all[validation_mask], probability))

    selected_name = max(validation_auc, key=validation_auc.get)
    selected_model = models[selected_name]
    decision_threshold = choose_threshold(
        y_all[validation_mask], validation_probabilities[selected_name])
    all_probabilities = selected_model.predict_proba(features)[:, 1]
    test_metrics = classification_metrics(
        y_all[test_mask], all_probabilities[test_mask], decision_threshold)
    validation_comparison = validation_auc

    prediction_columns = ["IncidentID", "CreatedAt", "DateKey", "DistrictKey",
                          "DistrictEN", "CategoryKey", "CategoryEN", "ChannelKey",
                          "Hour", "Shift", "Priority", "Status"]
    predictions = incidents[prediction_columns].copy()
    predictions["ActualBreach"] = incidents["BreachFlag"].astype("Int64")
    predictions["PredictedBreachProbability"] = all_probabilities
    predictions["PredictedBreach"] = (all_probabilities >= decision_threshold).astype(int)
    predictions["RiskBand"] = risk_bands(all_probabilities)
    predictions["ModelSplit"] = np.select(
        [train_mask, validation_mask, test_mask, ~resolved],
        ["Train", "Validation", "Test", "Active Scored"], default="Label Unavailable at Cutoff")
    predictions["ModelName"] = selected_name
    write_predictions(predictions, output_dir / "incident_ai_predictions.csv", decision_threshold)

    district_summary = (predictions.groupby(["DistrictKey", "DistrictEN"], as_index=False)
        .agg(TotalReports=("IncidentID", "count"),
             AveragePredictedRisk=("PredictedBreachProbability", "mean"),
             HighRiskReports=("RiskBand", lambda values: int((values == "High").sum())),
             PredictedBreaches=("PredictedBreach", "sum"),
             ActualBreachRate=("ActualBreach", "mean"))
        .sort_values("AveragePredictedRisk", ascending=False))
    district_summary.to_csv(output_dir / "district_ai_summary.csv", index=False, float_format="%.17g")

    importance = feature_importance_frame(selected_model)
    importance.to_csv(output_dir / "feature_importance.csv", index=False)
    grouped = importance.assign(FeatureGroup=importance["Feature"].map(feature_group))
    grouped = grouped.groupby("FeatureGroup", as_index=False)["Importance"].sum().sort_values("Importance", ascending=False)
    grouped["ImportanceShare"] = (grouped["Importance"] / grouped["Importance"].sum()).round(6)
    grouped.to_csv(output_dir / "feature_group_importance.csv", index=False)

    metrics = {
        "project_type": "Portfolio prototype using synthetic data",
        "framework": "scikit-learn Pipeline with ColumnTransformer preprocessing",
        "prediction_target": "SLA breach among reports resolved by the evaluation cutoff",
        "selected_model": selected_name,
        "decision_threshold": decision_threshold,
        "risk_band_thresholds": {"Low": "probability < 0.25",
                                 "Moderate": "0.25 <= probability < 0.40",
                                 "High": "probability >= 0.40"},
        "validation_roc_auc_comparison": validation_comparison,
        "test_metrics": test_metrics,
        "time_split": {"training": "created and resolved before 2026-02-01",
                       "validation": "created in February; resolved before 2026-03-01",
                       "testing": "created 2026-03-01 through 2026-04-05; resolved before 2026-04-06"},
        "row_counts": {"training": int(train_mask.sum()),
                       "validation": int(validation_mask.sum()),
                       "testing": int(test_mask.sum()),
                       "active_scored": int((~resolved).sum()),
                       "label_unavailable_at_cutoff": int((resolved & ~(train_mask | validation_mask | test_mask)).sum()),
                       "all_scored": int(len(incidents))},
        "test_breach_rate": round(float(y_all[test_mask].mean()), 4),
        "high_risk_count_all_rows": int((predictions["RiskBand"] == "High").sum()),
        "high_risk_count_open": int((predictions.RiskBand.eq("High") & predictions.Status.eq("Open")).sum()),
        "high_risk_count_in_progress": int((predictions.RiskBand.eq("High") & predictions.Status.eq("In Progress")).sum()),
        "high_risk_count_active": int((predictions.RiskBand.eq("High") & predictions.Status.isin(["Open", "In Progress"])).sum()),
        "leakage_exclusions": ["AssignedAt", "ResolvedAt", "ResponseHours",
                               "AssignmentDelayHours", "ResolutionHours", "SLAMet", "Status as a feature",
                               "WasReopened", "SatisfactionScore"],
        "limitations": ["All source records are synthetic.",
                        "Only six months of history are available.",
                        "The model is a portfolio prototype, not a production municipal system.",
                        "Evaluation is conditional on resolution by each cutoff; active cases are right-censored.",
                        "Historical test outcomes have already been inspected; this is a retrospective correction, not a new untouched holdout.",
                        "Static synthetic attributes and repeat flags lack live event/version logs.",
                        "Daily staffing aggregates are unverified at incident creation; diagnostic capacity runs must not be presented as leakage-safe.",
                        "The legacy 0.12 capacity allocation has no validated source justification."],
        "include_unverified_capacity": include_unverified_capacity,
        "feature_columns": categorical + numeric,
        "source_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DATA_DIR.glob("*.csv"))},
        "runtime": {"python": platform.python_version(), **{name: importlib.metadata.version(name)
                    for name in ["numpy", "pandas", "scikit-learn", "joblib"]}},
        "seed": SEED,
        "precision_policy": "Binary64 probabilities exported with 17 significant digits; no rounding before decisions",
    }
    (output_dir / "model_metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    rows = [{"Model": selected_name, "Dataset": "Test", "Metric": key, "Value": value}
            for key, value in test_metrics.items()
            if key not in {"true_positive", "true_negative", "false_positive", "false_negative"}]
    rows.extend({"Model": name, "Dataset": "Validation", "Metric": "roc_auc", "Value": value}
                for name, value in validation_comparison.items())
    pd.DataFrame(rows).to_csv(output_dir / "model_performance.csv", index=False)

    joblib.dump({"pipeline": selected_model, "model_name": selected_name,
                 "decision_threshold": decision_threshold,
                 "categorical_features": categorical, "numeric_features": numeric,
                 "trained_with": "scikit-learn"}, output_dir / "sla_risk_model.pkl")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--include-unverified-capacity", action="store_true",
                        help="Diagnostic ablation only: staffing features have no availability log")
    args = parser.parse_args()
    main(args.output_dir, args.include_unverified_capacity)
