"""Train and export a leakage-safe SLA breach risk model.

Uses scikit-learn Pipelines so preprocessing learned from the training period
is applied consistently to validation, test, and open synthetic reports.
"""

from __future__ import annotations

import json
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

SEED = 42
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_DIR = Path(__file__).resolve().parent


def classification_metrics(y_true, probabilities, threshold):
    predictions = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predictions, labels=[0, 1]).ravel()
    specificity = tn / (tn + fp) if tn + fp else 0.0
    return {
        "roc_auc": round(float(roc_auc_score(y_true, probabilities)), 4),
        "accuracy": round(float(accuracy_score(y_true, predictions)), 4),
        "precision": round(float(precision_score(y_true, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, predictions, zero_division=0)), 4),
        "specificity": round(float(specificity), 4),
        "f1": round(float(f1_score(y_true, predictions, zero_division=0)), 4),
        "brier_score": round(float(brier_score_loss(y_true, probabilities)), 4),
        "true_positive": int(tp), "true_negative": int(tn),
        "false_positive": int(fp), "false_negative": int(fn),
    }


def choose_threshold(y_true, probabilities):
    """Maximize validation F1 among thresholds with at least 70% recall."""
    scored = []
    for threshold in np.arange(0.20, 0.801, 0.01):
        metrics = classification_metrics(y_true, probabilities, float(threshold))
        scored.append((metrics["f1"], metrics["recall"], float(threshold)))
    eligible = [row for row in scored if row[1] >= 0.70]
    selected = max(eligible or scored, key=lambda row: (row[0], row[1], -row[2]))
    return round(selected[2], 2)


def prepare_data():
    incidents = pd.read_csv(DATA_DIR / "FactIncidents.csv")
    districts = pd.read_csv(DATA_DIR / "DimDistrict.csv")
    categories = pd.read_csv(DATA_DIR / "DimCategory.csv")
    channels = pd.read_csv(DATA_DIR / "DimChannel.csv")
    times = pd.read_csv(DATA_DIR / "DimTime.csv")
    capacity = pd.read_csv(DATA_DIR / "FactDailyCapacity.csv")

    incidents["CreatedAt"] = pd.to_datetime(incidents["CreatedAt"], errors="coerce")
    incidents["SLAMet"] = incidents["SLAMet"].map(
        {True: True, False: False, "True": True, "False": False})
    incidents = incidents.merge(
        districts[["DistrictKey", "DistrictEN", "Sector", "DemandWeight"]],
        on="DistrictKey", how="left")
    incidents = incidents.merge(
        categories[["CategoryKey", "CategoryEN", "Complexity"]],
        on="CategoryKey", how="left")
    incidents = incidents.merge(channels, on="ChannelKey", how="left")
    incidents = incidents.merge(
        times[["Hour", "TimeBand", "Shift"]], on="Hour", how="left")
    incidents = incidents.merge(
        capacity, on=["DateKey", "DistrictKey", "Shift"], how="left")

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
    numeric = ["SLATargetHours", "DemandWeight", "Complexity", "PlannedTeams",
               "AvailableTeams", "IncidentCapacity", "AvailabilityRatio",
               "IsWeekend", "IsRepeatNumeric", "HourSin", "HourCos",
               "DaySin", "DayCos"]
    features = incidents[categorical + numeric].copy()
    for column in categorical:
        features[column] = features[column].fillna("Unknown").astype(str)
    for column in numeric:
        features[column] = pd.to_numeric(features[column], errors="coerce")
    return incidents, features, categorical, numeric


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


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    incidents, features, categorical, numeric = prepare_data()
    resolved = incidents["Status"].eq("Resolved").to_numpy()
    created = incidents["CreatedAt"]
    train_mask = (resolved & (created < pd.Timestamp("2026-02-01"))).to_numpy()
    validation_mask = (resolved & (created >= pd.Timestamp("2026-02-01"))
                       & (created < pd.Timestamp("2026-03-01"))).to_numpy()
    test_mask = (resolved & (created >= pd.Timestamp("2026-03-01"))).to_numpy()
    y_all = incidents["BreachFlag"].fillna(0).astype(int).to_numpy()

    models = make_models(categorical, numeric)
    validation_auc, validation_probabilities = {}, {}
    for name, model in models.items():
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
    validation_comparison = {name: round(score, 4)
                             for name, score in validation_auc.items()}

    prediction_columns = ["IncidentID", "CreatedAt", "DateKey", "DistrictKey",
                          "DistrictEN", "CategoryKey", "CategoryEN", "ChannelKey",
                          "Hour", "Shift", "Priority", "Status"]
    predictions = incidents[prediction_columns].copy()
    predictions["ActualBreach"] = incidents["BreachFlag"].astype("Int64")
    predictions["PredictedBreachProbability"] = np.round(all_probabilities, 4)
    predictions["PredictedBreach"] = (all_probabilities >= decision_threshold).astype(int)
    predictions["RiskBand"] = pd.cut(
        all_probabilities, bins=[-np.inf, 0.25, 0.40, np.inf],
        labels=["Low", "Moderate", "High"], right=False).astype(str)
    predictions["ModelSplit"] = np.select(
        [train_mask, validation_mask, test_mask],
        ["Train", "Validation", "Test"], default="Open Scored")
    predictions["ModelName"] = selected_name
    predictions.to_csv(OUT_DIR / "incident_ai_predictions.csv", index=False)

    district_summary = (predictions.groupby(["DistrictKey", "DistrictEN"], as_index=False)
        .agg(TotalReports=("IncidentID", "count"),
             AveragePredictedRisk=("PredictedBreachProbability", "mean"),
             HighRiskReports=("RiskBand", lambda values: int((values == "High").sum())),
             PredictedBreaches=("PredictedBreach", "sum"),
             ActualBreachRate=("ActualBreach", "mean"))
        .sort_values("AveragePredictedRisk", ascending=False))
    district_summary["AveragePredictedRisk"] = district_summary["AveragePredictedRisk"].round(4)
    district_summary["ActualBreachRate"] = district_summary["ActualBreachRate"].round(4)
    district_summary.to_csv(OUT_DIR / "district_ai_summary.csv", index=False)

    importance = feature_importance_frame(selected_model)
    importance.to_csv(OUT_DIR / "feature_importance.csv", index=False)
    grouped = importance.assign(FeatureGroup=importance["Feature"].map(feature_group))
    grouped = grouped.groupby("FeatureGroup", as_index=False)["Importance"].sum().sort_values("Importance", ascending=False)
    grouped["ImportanceShare"] = (grouped["Importance"] / grouped["Importance"].sum()).round(6)
    grouped.to_csv(OUT_DIR / "feature_group_importance.csv", index=False)

    metrics = {
        "project_type": "Portfolio prototype using synthetic data",
        "framework": "scikit-learn Pipeline with ColumnTransformer preprocessing",
        "prediction_target": "SLA breach before incident resolution",
        "selected_model": selected_name,
        "decision_threshold": decision_threshold,
        "risk_band_thresholds": {"Low": "probability < 0.25",
                                 "Moderate": "0.25 <= probability < 0.40",
                                 "High": "probability >= 0.40"},
        "validation_roc_auc_comparison": validation_comparison,
        "test_metrics": test_metrics,
        "time_split": {"training": "2025-10-05 to 2026-01-31",
                       "validation": "2026-02-01 to 2026-02-28",
                       "testing": "2026-03-01 to 2026-04-05"},
        "row_counts": {"training": int(train_mask.sum()),
                       "validation": int(validation_mask.sum()),
                       "testing": int(test_mask.sum()),
                       "open_scored": int((~resolved).sum()),
                       "all_scored": int(len(incidents))},
        "test_breach_rate": round(float(y_all[test_mask].mean()), 4),
        "high_risk_count_all_rows": int((predictions["RiskBand"] == "High").sum()),
        "leakage_exclusions": ["AssignedAt", "ResolvedAt", "ResponseHours",
                               "ResolutionHours", "SLAMet", "Status as a feature",
                               "WasReopened", "SatisfactionScore"],
        "limitations": ["All source records are synthetic.",
                        "Only six months of history are available.",
                        "The model is a portfolio prototype, not a production municipal system.",
                        "Effective capacity uses a documented synthetic allocation assumption."],
    }
    (OUT_DIR / "model_metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    rows = [{"Model": selected_name, "Dataset": "Test", "Metric": key, "Value": value}
            for key, value in test_metrics.items()
            if key not in {"true_positive", "true_negative", "false_positive", "false_negative"}]
    rows.extend({"Model": name, "Dataset": "Validation", "Metric": "roc_auc", "Value": value}
                for name, value in validation_comparison.items())
    pd.DataFrame(rows).to_csv(OUT_DIR / "model_performance.csv", index=False)

    joblib.dump({"pipeline": selected_model, "model_name": selected_name,
                 "decision_threshold": decision_threshold,
                 "categorical_features": categorical, "numeric_features": numeric,
                 "trained_with": "scikit-learn"}, OUT_DIR / "sla_risk_model.pkl")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
