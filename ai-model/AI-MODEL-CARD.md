# SLA Breach Risk Model

Author: Yomna Alhejaili. Independent synthetic-data portfolio prototype.

## Intended use and data

Estimate eventual SLA breach to support human triage. This is a retrospective
demonstration on 30,000 supplied synthetic records, not a validated municipal
forecast or a deployed decision system. `data/PROVENANCE.md` distinguishes
recorded generation metadata from unknown generation rules.

The target is the source SLA outcome of resolved reports. Timestamp validation
confirms the labels; do not reconstruct labels from rounded resolution hours.
Active cases (Open or In Progress) are scored, never assigned negative labels.

## Availability-aware evaluation

- Train: created **and resolved before 1 February 2026**: 18,548 rows.
- Validation: created in February and resolved before 1 March: 4,483 rows.
- Test: created from 1 March through 5 April, resolved before 6 April: 6,057 rows.
- 645 historical resolved rows had labels unavailable at their original cohort
  cutoff (264 training, 381 validation). They are scored but marked
  `Label Unavailable at Cutoff`, excluded from fitting and model selection.
- 267 active records are marked `Active Scored` and excluded from supervised evaluation.

This corrects retrospective label-availability leakage. It still evaluates only
cases resolved by each cutoff; slower unresolved cases are censored and may
differ systematically. It is not a survival model or a complete-cohort estimate.
The historical test results have already been inspected, so the corrected test
is a retrospective comparison, not a new untouched holdout.

## Features and selection

The original Logistic Regression and AdaBoost decision-stump families, seed 42,
fitted ColumnTransformer/Pipeline preprocessing, and validation-only selection
are retained. No refit on validation or test labels occurs. Threshold selection
maximizes validation F1 over 0.20–0.80 in 0.01 increments with a 70% recall
constraint when feasible. Numeric values stay unrounded during selection.

The default model excludes PlannedTeams, AvailableTeams, IncidentCapacity and
AvailabilityRatio: their date/district/shift totals have no availability log
establishing that they were known when an incident was created. The diagnostic
`--include-unverified-capacity` run isolates the cutoff correction and requires
a separate output directory. It must not be used as the final model.

Assignment/response/resolution durations, final SLA result, status, reopening
and satisfaction remain excluded as features. Static synthetic district/category
attributes, intake fields and calendar encodings are retained. Repeat flags
agree with earlier records in RepeatGroupID in this snapshot; that is not a
live event-availability guarantee. Production use would require intake-time
snapshots, versioned dimensions, temporal monitoring and independent validation.

## Before and after (same 6,057 test rows)

| Metric | Historical | Corrected default |
|---|---:|---:|
| ROC-AUC | 0.6927 | 0.6870 |
| Recall | 0.7657 | 0.8529 |
| Precision | 0.3664 | 0.3362 |
| F1 | 0.4956 | 0.4823 |
| Accuracy | 0.5628 | 0.4864 |
| Brier score | 0.1841 | 0.1852 |
| Review threshold | 0.27 | 0.24 |
| False positives | 2,250 | 2,861 |
| False negatives | 398 | 250 |

AdaBoost is still selected. Higher recall costs more false alerts and lower
precision; these corrected results replace old headline claims even when they
do not match screenshots. The full cutoff-only experiment and confusion
matrices are in `documentation/validation-comparison.json`.

## Scores, bands and populations

Binary review flags use the validation threshold **0.24**. Separate descriptive
risk bands retain their original definitions: Low < 0.25; Moderate 0.25–<0.40;
High >= 0.40. A review flag is therefore not synonymous with High risk.

Probabilities are exported as binary64 values with 17 significant digits.
Do not round before thresholding; format percentages only for display. Python
CSV consumers should use `float_precision="round_trip"`. The old 77 discrepancies
arose because scores from 0.2699536372 to 0.2699750533 were exported as 0.2700.
Lossless export fixes that inconsistency without changing a fitted model's decisions.

Corrected counts: **3,371 High risk across all rows; 39 Active High risk**,
comprising **39 In Progress and 0 Open**. Source status counts remain 29,733
Resolved, 265 In Progress and 2 Open. All-row scores include training records
and must not be presented as held-out predictions.

## Reproducibility and limitations

Run the commands in README.md. Model metrics record feature names, source
hashes, dependency versions and seed. The fitted pipeline is generated locally
as the ignored `sla_risk_model.pkl`; never load untrusted pickle files.

All data is synthetic; the original generator is absent. Relationships do not
establish real municipal behavior. Only six months are available. The model is
not externally validated, fairness-tested or deployed. Human review is required.
Daily capacity remains nominal synthetic capacity; the historical 0.12 allocation
factor has no validated source basis and is not a model feature or a validated
staffing recommendation. The PBIX and PDF exports have not been refreshed in
Power BI Desktop; follow the Desktop handoff before presenting their metrics.
