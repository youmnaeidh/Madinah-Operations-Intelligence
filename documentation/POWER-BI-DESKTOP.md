# Power BI Desktop handoff — preserve the existing design

The existing PBIX, four screenshots, both PDFs, and embedded visual resources
are unchanged. The map, mountains, background image, colors, page composition,
visual positions, and sizes must remain exactly as they are. This remediation
provides source corrections and a manual Desktop handoff; **Power BI Desktop
was not run**, and DAX/M execution, refresh and rendering are not verified here.

The archived report is still a historical snapshot. Updating Python/CSV/DAX
files does not update its imported data, embedded measures, static SVG/text
overlays or PDF exports. Do not present the old screenshots as corrected output.

## 1. Open and preserve the report

Work from the remediation branch in the original repository. Keep an untouched
copy of the existing PBIX while applying the steps in Desktop. Do not open or
modify `backup-before-remediation-2026-10-19`. Do not redesign any page, rebuild
the map or replace Power BI. Compare the corrected working copy visually with
all four original screenshots before any approved PBIX save/export.

Read-only inspection here covered ZIP members and `Report/Layout` (4 pages,
119 visual containers). Embedded semantic-model/M definitions are compressed in
`DataModel` and were not decoded. We cannot assert the exact embedded source
paths or that `dax/measures.dax` previously matched every embedded measure.
The 0.12 allocation is numerically evidenced by the displayed capacity and source
totals; it is not a recovered original generation rule.

## 2. Make sources portable

1. In Power Query, create/edit the text parameter **RepositoryRoot** from
   `power-query/RepositoryRoot.pq`, setting it to the checkout folder on this
   machine. This is the only machine-specific path. Use a local checkout, not a
   GitHub HTML URL. Gateway/service refresh would need its own accessible path
   and credentials and has not been tested.
2. Create the **fnReadRepositoryCsv** function from the matching `.pq` file;
   disable load for the parameter and function.
3. Use the templates in `power-query/` for each identically named table. For
   existing queries, replace their source with the parameterized reader and
   retain any necessary downstream steps/calculated columns. Do not remove
   visual dependencies or create duplicate tables. Review the existing query
   dependencies in Desktop before replacing whole query definitions.
4. `FactIncidents.pq` preserves all 24 original columns, including the unknown
   historical `ResponseHours`, and adds only **AssignmentDelayHours** from
   `Duration.TotalHours(AssignedAt - CreatedAt)`. Invalid/missing timestamps must
   fail, not become zero. This is assignment delay, not arrival/first response.
5. Set probability columns to **Decimal Number** (`type number`, binary64),
   never Fixed Decimal/Currency, whole number or rounded transforms. The CSV
   preserves 17 significant digits. Format percentages in visuals only.
6. Load **ModelSettings** from model_metrics.json and **model_performance** from
   CSV as disconnected metadata tables. The threshold and test recall must
   come from these exports rather than old text/hardcoded values.
7. **CapacityAllocation** is a disconnected single-row parameter table whose
   factor defaults to null. Leave it null for nominal reporting. A value of
   0.12 reproduces only the explicitly labelled, unvalidated legacy scenario;
   it does not establish an operational capacity allocation.

Static checks verify all 13 CSV query schemas against the actual file headers.
The templates have **not** been executed by a Power Query engine here.

## 3. Check relationships and filter grain

- DateKey and DistrictKey dimensions filter both incident and capacity facts,
  single direction, one-to-many. DimDate[Date] is a date type and a marked date
  table. Category, Channel and Team dimensions filter incidents only.
- DimTime[Hour] filters incidents. Capacity is date/district/**shift**, not
  hour/category/channel/team. The supplied capacity measures project the
  selected DimTime shift with `TREATAS`; do not add a many-to-many fact join.
  They return blank for unsupported category, channel, team, hour or time-band
  filters rather than inventing capacity allocations.
- FactIncidents and incident_ai_predictions have one row per IncidentID.
  The supplied risk measures explicitly transfer the filtered incident IDs with
  `TREATAS`, including when predictions are disconnected. They do not require
  adding a new relationship or dimension. Inspect existing paths and avoid
  ambiguous parallel paths through prediction/date/district tables. Do not
  assume a one-to-one relationship can be configured as single-direction.
  For the row-level priority queue, add a visual filter **Active High Risk
  Reports > 0** so incident-side filters also gate prediction-table rows.
- Never sum averages in district_ai_summary or use its all-history aggregates
  for interactive date/shift filters. Compute interactive risk from incident
  scores with the incident-level filter path.
- Model performance/importance/settings tables are model-wide metadata. A
  district slicer must not make held-out model recall appear district-specific.

## 4. Apply measures and correct overlays only

Apply `dax/measures.dax` to the existing measure table, checking each measure in
Desktop. Apply `dax/calculated-columns.dax` as a column in FactIncidents.
Preserve the old useful volume, quality and time-intelligence calculations.
Remove the obsolete Average Response Hours measure **after** rebinding any
visual dependencies to Average Assignment Delay Hours and correcting its label.

| Current display/dependency | Required correction in the same position |
|---|---|
| Open Reports = 267 | Bind to Active Reports and caption **Active Reports**. Strict Open Reports is 2; In Progress is 265. |
| Open High Risk = 53 | Bind/caption **Active High Risk**; corrected count 39 (39 In Progress, 0 Open). |
| SLA status legend Open | The source population is Active. Change the calculated display category and legend to Active while retaining its existing gold #C9A86A color. Met/Breached retain their existing colors. |
| Effective Capacity = 42.84K | Bind to Nominal Incident Capacity and caption **Nominal Incident Capacity**: 356,984. Do not retain an unexplained 12% factor. |
| Capacity Utilization = 70.0% | Bind to the documented nominal denominator and label **Demand / Nominal Capacity**: 8.4037%. It is a synthetic ratio, not measured field productivity. |
| Demand vs Effective Capacity | Use Nominal Incident Capacity for the existing series, correcting title/legend only. Preserve layout and palette. |
| District utilization and recommendations | Recompute from the chosen documented denominator. Do not retain historical 126.9% Central Area overload claims as validated facts. Remove unsupported numeric staffing advice. |
| Avg Teams by Shift | Use the provided averages of daily district/shift allocation totals. They are not counts of distinct people or the 48 DimTeam roster records. |
| Model Recall | Dynamic held-out test recall: **85.2855%** (display 85.3%). |
| Project Info/static model performance | ROC-AUC **68.7020%** (68.7%), review threshold **24%**, AdaBoost unchanged. Describe cutoff-aware validation and remaining limitations. |
| High Risk Reports | **3,371**, all 30,000 rows, including training records; not held-out performance. |
| Average Predicted Risk | Refresh from the new incident-level scores. Format only; do not use old 30.1% text. |
| High-Risk Priority Queue | Filter **Active High Risk Reports > 0**, retaining only Open or In Progress AND RiskBand High (probability >= 0.40). The binary review flag at 0.24 is a different concept. |
| Response/assignment speed caption | Use **Assignment Delay Hours**, timestamp-derived; unfiltered average 0.3071824h. Keep the source ResponseHours column unchanged. |

The provided Effective Incident Capacity and Scenario Capacity Utilization
measures remain blank until a scenario factor in (0, 1] is explicitly supplied.
If a 12% scenario is shown, label it as unvalidated beside the existing visual;
do not substitute it into the primary nominal KPIs. The existing Pressure Score
weights/bands are retained only as a transparent illustrative index, recomputed
using nominal capacity. They are not validated risk/staffing thresholds. The
unsupported period-gap/4 additional-teams heuristic is disabled.

`Report/Layout` also shows metric-related registered SVG overlays, including
`project-info-content...svg` and KPI-label resources. A data refresh alone may
not update their text. Inspect and change only the inaccurate text/metric
overlays. Leave the embedded `madinah-offline-map-background...png`, mountains,
backgrounds, theme, colors, and geometry untouched.

## 5. Verify in Desktop before a refreshed deliverable

- Refresh without missing sources, type errors, duplicate keys or broken visuals.
- Unfiltered: 30,000 incoming; 29,733 resolved; 267 active = 2 Open + 265 In
  Progress. SLA compliance uses only resolved reports (73.5109%); median
  resolution 28.28h and repeat rate 8.4367% are accurate historical KPIs.
- Reconcile capacity by date, district and each shift, including the partial
  April interval through 5 April. Confirm unsupported category/hour slices are
  blank and that no implicit 0.12 multiplier or unique-team inference remains.
- Confirm all 30,000 probabilities, binary flags, risk bands and IncidentID
  joins; test score boundaries 0.24, 0.25 and 0.40 without rounding transforms.
- Confirm 39 Active High Risk = 39 In Progress + 0 Open, and the active queue
  excludes resolved reports. Check status/date/district/shift filter contexts.
- Compare every page with the original screenshots: original map, mountains,
  backgrounds, colors, sizes and composition unchanged. Only corrected labels,
  metrics, captions and information overlays may differ.
- Re-export both PDFs and screenshots only after Desktop validation, preserving
  the original author's attribution. Record the Desktop version, refresh time,
  tested filters and any warnings. None of these Desktop steps are claimed as
  completed by the cloud remediation.

The PR must not be merged and main must not be edited without the owner's
approval. The backup branch remains an immutable historical reference.
