"""Validate the supplied synthetic tables without rewriting historical records."""

from pathlib import Path

import numpy as np
import pandas as pd


def assignment_delay_hours(incidents):
    """Elapsed assignment time from timestamps; ResponseHours has unknown semantics."""
    created = pd.to_datetime(incidents["CreatedAt"], errors="raise")
    assigned = pd.to_datetime(incidents["AssignedAt"], errors="raise")
    delay = (assigned - created).dt.total_seconds() / 3600
    if created.isna().any() or delay.isna().any() or (delay < 0).any():
        raise ValueError("CreatedAt/AssignedAt must be present and ordered")
    return delay


def load_source_tables(data_dir):
    tables = {p.stem: pd.read_csv(p) for p in Path(data_dir).glob("*.csv")}
    validate_source_tables(tables)
    return tables


def validate_source_tables(tables):
    """Fail before fitting on broken grains, joins, timestamps or target labels."""
    incidents = tables["FactIncidents"]
    capacity = tables["FactDailyCapacity"]
    keys = {
        "DimDistrict": "DistrictKey", "DimCategory": "CategoryKey",
        "DimChannel": "ChannelKey", "DimTeam": "TeamKey",
        "DimTime": "Hour", "DimDate": "DateKey",
        "FactIncidents": "IncidentID",
    }
    for table, key in keys.items():
        if tables[table][key].isna().any() or tables[table][key].duplicated().any():
            raise ValueError(f"{table}.{key} must be non-null and unique")
    for table, key in keys.items():
        if table.startswith("Dim") and not incidents[key].isin(tables[table][key]).all():
            raise ValueError(f"Unknown FactIncidents.{key}")
    grain = ["DateKey", "DistrictKey", "Shift"]
    if capacity[grain].isna().any().any() or capacity.duplicated(grain).any():
        raise ValueError("Capacity grain must be unique date/district/shift")
    for table, key in [("DimDistrict", "DistrictKey"), ("DimDate", "DateKey")]:
        if not capacity[key].isin(tables[table][key]).all():
            raise ValueError(f"Unknown capacity {key}")
    if not capacity.Shift.isin(tables["DimTime"].Shift).all():
        raise ValueError("Unknown capacity shift")
    for col in ["PlannedTeams", "AvailableTeams", "IncidentCapacity"]:
        values = pd.to_numeric(capacity[col], errors="raise")
        if not np.isfinite(values).all() or (values < 0).any():
            raise ValueError(f"Invalid capacity {col}")
    if (capacity.AvailableTeams > capacity.PlannedTeams).any():
        raise ValueError("AvailableTeams exceeds PlannedTeams")
    joined = incidents.merge(tables["DimTime"], on="Hour", validate="many_to_one")
    joined = joined.merge(capacity, on=grain, how="left", validate="many_to_one", indicator=True)
    if not joined["_merge"].eq("both").all():
        raise ValueError("Missing date/district/shift capacity")
    assignment_delay_hours(incidents)
    created = pd.to_datetime(incidents.CreatedAt, errors="raise")
    assigned = pd.to_datetime(incidents.AssignedAt, errors="raise")
    resolved_at = pd.to_datetime(incidents.ResolvedAt, errors="raise")
    resolved = incidents.Status.eq("Resolved")
    if not incidents.Status.isin(["Open", "In Progress", "Resolved"]).all():
        raise ValueError("Unknown incident status")
    if not resolved_at.notna().eq(resolved).all():
        raise ValueError("ResolvedAt/status inconsistency")
    if not incidents.ResolutionHours.notna().eq(resolved).all():
        raise ValueError("ResolutionHours/status inconsistency")
    if (resolved_at[resolved] < assigned[resolved]).any():
        raise ValueError("Resolution precedes assignment")
    if not created.dt.strftime("%Y%m%d").astype(int).eq(incidents.DateKey).all():
        raise ValueError("DateKey disagrees with CreatedAt")
    if not created.dt.hour.eq(incidents.Hour).all():
        raise ValueError("Hour disagrees with CreatedAt")
    if (incidents.SLATargetHours <= 0).any():
        raise ValueError("SLA target must be positive")
    duration = (resolved_at - created).dt.total_seconds() / 3600
    if (abs(duration[resolved] - incidents.loc[resolved, "ResolutionHours"]) > .0051).any():
        raise ValueError("ResolutionHours exceeds source rounding tolerance")
    for col in ["SLAMet", "IsRepeat", "WasReopened"]:
        if not incidents[col].isin([True, False]).all():
            raise ValueError(f"Invalid boolean {col}")
    # Use second-precision timestamps: four source durations round onto the SLA boundary.
    if not (duration[resolved] <= incidents.loc[resolved, "SLATargetHours"]).eq(
            incidents.loc[resolved, "SLAMet"]).all():
        raise ValueError("SLA result disagrees with timestamp duration")
    if not incidents.DataClass.eq("Synthetic").all():
        raise ValueError("Expected synthetic records only")
    for col, lower, upper in [("Latitude", -90, 90), ("Longitude", -180, 180)]:
        if not incidents[col].between(lower, upper).all():
            raise ValueError(f"Invalid {col}")
    return {"incident_rows": len(incidents), "capacity_rows": len(capacity)}
