# Synthetic data provenance

Author and project attribution: Yomna Alhejaili. This independent portfolio
project was inspired by internship experience; it is not an official municipal
system. All 30,000 incident records are labelled Synthetic.

`generation_metadata.json` records seed **20260405**, the reporting interval
**2025-10-05 to 2026-04-05**, and the synthetic-data disclaimer. These are
historical metadata claims, not a reproducible generation recipe. The original
generator, distributions, parameter choices, timestamp rules, and explanations
for the source `ResponseHours` values are not present in the repository.
Do not reconstruct or invent those rules. Training seed 42 is separate from the
recorded generation seed.

The supplied CSVs are the immutable source for this remediation. SHA-256 hashes
are recorded in `documentation/source-asset-manifest.json`; no incident record
has been regenerated or corrected in place. Reproducibility covers validation,
model fitting and derived exports from these exact CSVs, not original synthetic
data generation. Synthetic status is documented by the source; it does not
establish realistic municipal distributions, fairness or production fitness.

Observed facts (not claims about original generation rules):

- `ResponseHours` disagrees with `(AssignedAt - CreatedAt)` in every source row.
  Its operational definition is unknown. Keep it for historical fidelity and
  exclude it from response/assignment KPIs and predictive features.
- `AssignmentDelayHours` is a derived metric: exact timestamp elapsed seconds /
  3600. All 30,000 timestamp pairs are present and ordered. It measures
  assignment delay, not arrival, first contact or service response.
- Resolved durations agree with timestamp durations within the two-decimal
  source rounding tolerance. Four SLA outcomes differ from comparing the
  rounded `ResolutionHours` against the target; **all** agree with second-
  precision timestamps. Preserve their source labels.
- `IncidentCapacity = AvailableTeams * 4` holds for the 6,588 supplied
  date/district/shift records. This is a source relationship, not evidence of
  real productivity. `DimTeam.NominalDailyCapacity` is a separate team-level
  reference; the capacity fact is not a roster of those 48 unique teams.
- The dashboard's displayed 42.84K effective capacity is consistent with
  `356984 * 0.12 = 42838.08`. No source records or metadata justify this
  allocation factor. Treat 12% only as an unvalidated historical scenario.
- Timestamps have no timezone or event-availability log. Model evaluation uses
  their supplied local clock consistently and makes no claim about UTC or live
  availability of daily staffing aggregates.

Data limitations and dashboard corrections are detailed in the remediation
report and Power BI Desktop handoff under `documentation/`.
