# Technical remediation evidence — 19 October 2026

Repository: **youmnaeidh/Madinah-Operations-Intelligence**. Baseline commit:
`ed3ab0aeea07fdc21623fd761c6dce376fda2105`. Dedicated branch:
`remediation/technical-2026-10-19`, created from the verified latest main.
All publishing uses the connected GitHub integration in this original repository.
No separate Development repository is used. Main is not updated or merged, and
`backup-before-remediation-2026-10-19` is never written.

The corrections below are implemented in Python, derived CSV/JSON exports,
documented DAX, portable M templates and tests. **The embedded PBIX has not been
modified or refreshed.** DAX/M execution, overlay corrections, relationship
checks and PDF/screenshot re-exports remain Power BI Desktop work. See the
[exact handoff](POWER-BI-DESKTOP.md). Existing map, mountains, backgrounds,
colors and composition remain byte-for-byte unchanged with the entire PBIX.

## 1. Preserve source data; correct assignment-delay semantics

All 30,000 source rows are unchanged. `ResponseHours` differs from timestamp
assignment delay in every row (source mean 0.853664h versus timestamp-derived
mean 0.3071823796h). No source definition or generator explains the discrepancy.
Do not rename that column as a validated response metric or multiply timestamps
to force agreement. Preserve it as historical data with unknown semantics.

`data_quality.assignment_delay_hours` validates non-null, ordered timestamps and
derives elapsed seconds / 3600. The M template adds AssignmentDelayHours without
changing the source CSV; DAX provides correctly named average/median measures.
The old Average Response Hours definition is removed from the text measure
file. Assignment delay remains excluded from creation-time model features.

Four apparent source SLA errors are actually rounded durations exactly on the
SLA target: SYN-010660, SYN-019839, SYN-028249 and SYN-028305. All source labels
agree with second-precision timestamps. The original labels are preserved;
validation must not re-label them using rounded ResolutionHours.

## 2. Correct temporal label and feature availability

The historical code selected resolved cases by CreatedAt only. That admitted
264 training labels resolved on/after 1 February and 381 validation labels
resolved on/after 1 March. Corrected masks require resolution strictly before
the decision cutoff. Those 645 rows remain scored but cannot affect their
original cohort's fitting or model/threshold selection.

| Cohort | Historical rows | Corrected rows |
|---|---:|---:|
| Train | 18,812 | 18,548 |
| Validation | 4,864 | 4,483 |
| Test | 6,057 | 6,057 |
| Active, scored without labels | 267 | 267 |
| Resolved, label unavailable at original cutoff | implicitly included | 645 excluded from fit/selection |

Keep the original Logistic Regression and AdaBoost stump Pipelines, seed 42,
hyperparameters and validation-based selection rule. The final default also
excludes PlannedTeams, AvailableTeams, IncidentCapacity and AvailabilityRatio:
daily totals lack creation-time availability logs. An isolated diagnostic
retains them to separate the cutoff correction from this conservative feature
restriction. Remaining static synthetic attributes and repeat-history fields
are documented assumptions, not independently verified live feature snapshots.

## 3. Model before/after

| Test metric | Historical reproduced | Cutoff correction, staffing diagnostic | Corrected default |
|---|---:|---:|---:|
| ROC-AUC | 0.6927 | 0.6924 | 0.6870 |
| Recall | 0.7657 | 0.7916 | 0.8529 |
| Precision | 0.3664 | 0.3567 | 0.3362 |
| F1 | 0.4956 | 0.4918 | 0.4823 |
| Accuracy | 0.5628 | 0.5410 | 0.4864 |
| Brier score | 0.1841 | 0.1841 | 0.1852 |
| Validation-selected review threshold | 0.27 | 0.26 | 0.24 |
| True positive | 1,301 | 1,345 | 1,449 |
| True negative | 2,108 | 1,932 | 1,497 |
| False positive | 2,250 | 2,426 | 2,861 |
| False negative | 398 | 354 | 250 |

AdaBoost is selected in every run. Higher recall comes with more false alerts,
lower precision and slightly worse discrimination/calibration; do not imply
that every metric improved. Selection uses validation only and does not refit
on validation/test outcomes. Exact results, candidate validation ROC-AUCs and
row counts are in `validation-comparison.json`, `ai-model/model_metrics.json`
and the model card.

The test set has already been inspected historically; this is a retrospective
correction, not a new untouched holdout. Evaluation remains conditional on
resolution by each cutoff. Unresolved cases are censored and may differ from
resolved cases; no unbiased complete-cohort claim or production deployment is
made. A future prospective evaluation needs outcome-maturity windows, feature
availability logs and additional independent data.

## 4. Preserve probability precision

All 77 legacy disagreements are scores strictly below 0.27 (observed range
0.2699536372243492–0.2699750533359859) exported as 0.2700. Stored flags were
computed from full precision and are correct for that historical model;
re-thresholding the rounded export flips those 77 flags. The investigation
reloaded the reproduced historical pipeline and verified its raw decisions
against all original flags. No historical source record is changed.

Corrected exports use 17 significant digits and round-trip checks. Persisted
scores reproduce the model's probabilities, flags, bands, district means and
test metrics. The numerical export correction itself changes zero decisions
for a fixed fitted model; retraining and threshold correction legitimately
change the final predictions. The review threshold (0.24) is independent of
descriptive bands: Low < 0.25, Moderate 0.25–<0.40, High >= 0.40.

## 5. Reconcile capacity and populations

Capacity facts have date/district/shift grain, with source IncidentCapacity
equal to AvailableTeams * 4 in every supplied row. The 48 DimTeam records are a
different reference grain, not the count of all district/shift allocations.
Nominal source capacity is **356,984**; demand/nominal capacity is **8.4037%**.
The legacy **42,838.08** (42.84K) and **70.0311%** reproduce only after applying
the unvalidated 0.12 allocation scenario. No provenance supports treating that
factor as actual effective productivity. It is disclosed as historical, not
invented as an original generation rule. The optional scenario parameter has
no default factor; unsupported category/hour capacity slices return blank.

Capacity measures use the nominal denominator, explicit shift filter transfer,
and grain safeguards. Numeric additional-team advice is disabled: a period
gap divided by 4 is not a defensible number of additional unique teams. The
original illustrative pressure-index formula remains documented as a heuristic,
not a validated staffing or risk standard. The Central Area source ratio is
15.2282% of nominal capacity; old 126.9% claims depend on the 12% scenario.

| Population | Source count / corrected count |
|---|---:|
| Incoming | 30,000 |
| Resolved | 29,733 |
| Open (exact status) | 2 |
| In Progress | 265 |
| Active (Open + In Progress) | 267 |
| High Risk, all rows | 3,371 |
| Open High Risk | 0 |
| In Progress High Risk | 39 |
| Active High Risk | 39 |

The historical “Open High Risk = 53” meant 1 Open + 52 In Progress under the old
model. It must not remain an Open-only label. Corrected risk measures explicitly
transfer incident IDs instead of assuming an embedded filter direction. The
priority queue requires Active AND High risk, not just the binary review flag.

Accurate source KPIs stay accurate: SLA compliance = 21,857 / 29,733 = 73.5109%;
median resolution = 28.28h; repeat rate = 2,531 / 30,000 = 8.4367%; team
availability = 89,246 / 91,696 = 97.3281%. Unfiltered current average predicted
risk is 28.7991%, including training rows; it is not held-out performance.
Different PDF visual totals/filters must be checked in Desktop; no guessed
filter explanation is used to force agreement. Independent source results are
in `dashboard-kpi-reconciliation.json`.

## 6. Documentation, dependencies and configuration audit

- **README:** retained the author's context, contribution, attribution and
  original preview assets. Replaced stale model claims; added status/capacity
  definitions, repeatable commands and a visible historical-export notice.
- **Model card and code comments:** corrected availability claims, cutoffs,
  metrics, censoring, score precision and the limits of synthetic data. Removed
  unconditional leakage-safe wording; retained useful pipeline explanations.
- **Case Study PDF (6 pages):** text inspected using pypdf 6.10.0. Author and
  project context remain useful. Page 4's effective-capacity/overload narrative
  needs qualification; page 5's 69.3%, 76.6%, 27% and Open High-Risk 53 are
  historical. Preserve the PDF as an archived export until Desktop/authoring
  refresh, rather than deleting its attribution or presenting it as current.
- **Dashboard PDF (4 pages):** text and PBIX layout inspected read-only. The
  Operations capacity labels and AI/Project Info metrics are stale relative to
  corrected definitions. The entire PDF remains untouched; re-export only
  after Desktop validation. Existing SLA 73.5%, median 28.3h and repeat 8.4%
  are supported by the immutable CSVs.
- **Synthetic metadata:** preserve the recorded generation seed 20260405 and
  dates. Original generator/rules are absent. `data/PROVENANCE.md` separates
  observed relationships from unsupported generation claims.
- **Dependencies:** joblib 1.5.3 and NumPy 2.3.5 retained. pandas/scikit-learn
  pins now match the actually tested 2.2.3/1.8.0 environment on Python 3.12.14.
  That environment reproduces the historical metrics exactly. No claim is made
  that the former pins were invalid or that future versions are interchangeable.
- **.gitignore:** reviewed and retained. Generated pickle, environments, caches
  and temporary logs remain excluded. No credentials, irrelevant features or
  deployment configuration were introduced. No file was removed merely because
  it was old; obsolete metric definitions/claims were corrected in place.

## 7. Executed evidence and remaining limits

- Before the first commit: **5 tests passed**, source/asset hashes and broken
  source-grain/label/timestamp checks.
- Before the model commit: **12 tests passed**, plus all 30,000 persisted scores
  checked against the fitted pipeline, flags/bands, district means and test
  metrics. Zero probability/flag/band/model-score mismatches.
- Before the Power BI definition commit: **14 tests passed**, including
  independent KPI aggregation and static schema coverage for every CSV query.
- Independent full reproduction re-ran the historical source from real Git
  history plus both corrected variants. Historical metrics match exactly; all
  six final CSV/JSON exports match byte-for-byte. No source regeneration occurred.
- `git diff --check` passes. Source CSVs, generation metadata, original PBIX,
  screenshots and PDFs match the recorded SHA-256 manifest. Published Git tree
  verification also checks protected blobs against the baseline tree.
- Direct shell GitHub access still fails because its proxy is unreachable.
  Publishing through the connected GitHub tools succeeds and is verified per
  commit. This is a network limitation, not a remaining test failure.
- **Not executed:** Power BI Desktop, M runtime, DAX engine/filter-context tests,
  embedded-model refresh, layout rendering, and refreshed PDF/screenshot export.
  The handoff is required before claiming a corrected desktop report. There
  are no remaining observed Python regression-test failures.

The source/asset manifest records the exact immutable inputs. The baseline JSON
records historical metrics, the 77 affected IDs, source observations and tested
versions. The controlled comparison and KPI JSONs provide machine-readable
evidence. Each change is proposed on the remediation branch; merging into main
requires the owner's separate approval.
