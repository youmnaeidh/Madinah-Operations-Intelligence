# SLA Breach Risk Model

## Intended use

This portfolio prototype estimates the probability that a municipal incident will breach its SLA. It is designed to demonstrate how machine-learning outputs can support prioritization in a Power BI operations workflow.

## Data and target

- Source: 30,000 synthetic municipal incident records.
- Target: `BreachFlag = 1` when a resolved report did not meet its SLA.
- Training: 5 October 2025 through 31 January 2026.
- Validation: 1–28 February 2026.
- Test: 1 March through 5 April 2026.
- Open incidents are scored but excluded from supervised training and evaluation.

## Leakage controls

Only information available at or shortly after incident creation is used. The model excludes resolution timestamps, response and resolution duration, final SLA result, reopened status, satisfaction score, and status as a predictive feature.

## Candidate models

- Logistic Regression baseline implemented with scikit-learn.
- AdaBoost with decision stumps implemented with scikit-learn.

Both candidates use a fitted `Pipeline` containing a `ColumnTransformer`.
Numeric fields receive median imputation and standardization; categorical
fields receive imputation and one-hot encoding. This keeps learned
preprocessing restricted to the training period and packages it with the
selected model for consistent scoring.

The selected model is AdaBoost because it achieved the stronger validation ROC-AUC.

## Held-out test performance

- ROC-AUC: 0.6927
- Recall: 0.7657
- Precision: 0.3664
- F1: 0.4956
- Accuracy: 0.5628
- Brier score: 0.1841
- Decision threshold: 0.27

Recall is intentionally prioritized to identify more potential SLA breaches. The tradeoff is a higher false-alert rate, so predictions should support human triage rather than automate final decisions.

## Risk bands

- Low: probability below 0.25.
- Moderate: probability from 0.25 to below 0.40.
- High: probability of 0.40 or above.

## Limitations

- All records and outcomes are synthetic.
- Only six months of history are available.
- The learned relationships reflect the synthetic data generator, not real municipal behavior.
- The model has not been externally validated, fairness-tested, or deployed.
- It must be presented as a portfolio prototype, not a production municipal AI system.
