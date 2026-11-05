"""Reconcile dashboard populations and nominal capacity from the immutable CSVs."""

import argparse
import json
from pathlib import Path

import pandas as pd

from data_quality import assignment_delay_hours, load_source_tables
from train_sla_risk_model import ROOT


def audit():
    tables = load_source_tables(ROOT / "data")
    incidents, capacity = tables["FactIncidents"], tables["FactDailyCapacity"]
    scores = pd.read_csv(ROOT / "ai-model/incident_ai_predictions.csv", float_precision="round_trip")
    combined = incidents.merge(scores[["IncidentID", "RiskBand", "PredictedBreachProbability"]],
                               on="IncidentID", validate="one_to_one", how="left")
    if combined.RiskBand.isna().any():
        raise ValueError("Missing incident predictions")
    resolved = incidents.Status.eq("Resolved")
    active = incidents.Status.isin(["Open", "In Progress"])
    nominal = int(capacity.IncidentCapacity.sum())
    delay = assignment_delay_hours(incidents)
    by_district = []
    for row in tables["DimDistrict"].itertuples():
        reports = incidents.DistrictKey.eq(row.DistrictKey)
        district_nominal = int(capacity.loc[capacity.DistrictKey.eq(row.DistrictKey), "IncidentCapacity"].sum())
        by_district.append({"DistrictKey": row.DistrictKey, "DistrictEN": row.DistrictEN,
                            "reports": int(reports.sum()), "nominal_capacity": district_nominal,
                            "demand_over_nominal_capacity": float(reports.sum() / district_nominal)})
    high = combined.RiskBand.eq("High")
    return {
        "source_rows": len(incidents),
        "status_counts": incidents.Status.value_counts().to_dict(),
        "active_reports": int(active.sum()),
        "sla_met_resolved": int(incidents.loc[resolved, "SLAMet"].sum()),
        "sla_breached_resolved": int((~incidents.loc[resolved, "SLAMet"]).sum()),
        "sla_compliance_resolved": float(incidents.loc[resolved, "SLAMet"].mean()),
        "median_resolution_hours": float(incidents.loc[resolved, "ResolutionHours"].median()),
        "repeat_reports": int(incidents.IsRepeat.sum()),
        "repeat_rate": float(incidents.IsRepeat.mean()),
        "average_assignment_delay_hours": float(delay.mean()),
        "median_assignment_delay_hours": float(delay.median()),
        "response_hours_definition": "Unknown historical source field; excluded from assignment/response KPIs",
        "nominal_incident_capacity": nominal,
        "demand_over_nominal_capacity": float(len(incidents) / nominal),
        "observed_capacity_per_available_team_allocation": 4 if capacity.IncidentCapacity.eq(capacity.AvailableTeams * 4).all() else None,
        "capacity_fact_grain": "date/district/shift; allocations are not unique team headcounts",
        "team_availability_rate": float(capacity.AvailableTeams.sum() / capacity.PlannedTeams.sum()),
        "legacy_scenario_only": {"allocation_factor": .12, "validated": False,
                                 "effective_capacity": nominal * .12,
                                 "demand_over_effective_capacity": len(incidents) / (nominal * .12)},
        "high_risk_all_rows": int(high.sum()),
        "high_risk_open": int((high & combined.Status.eq("Open")).sum()),
        "high_risk_in_progress": int((high & combined.Status.eq("In Progress")).sum()),
        "high_risk_active": int((high & combined.Status.isin(["Open", "In Progress"])).sum()),
        "mean_risk_all_rows_including_training": float(combined.PredictedBreachProbability.mean()),
        "by_district": by_district,
        "power_bi_desktop_verified": False,
        "validation_scope": "Independent CSV aggregation; DAX/M execution and report refresh require Power BI Desktop",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    text = json.dumps(audit(), indent=2) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")
