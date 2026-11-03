# Final CI and release QA

The Windows CI defect is fixed. The remaining release task is the caption on the 8.4% card and the corresponding Desktop exports. PR #1 remains open and unmerged.

## Source-byte preservation and CI

Failed run [41391314938](https://github.com/youmnaeidh/Madinah-Operations-Intelligence/actions/runs/41391314938) reported nine source SHA-256 failures and a dependent source-hash error. There was no `.gitattributes` file. With `core.autocrlf=true`, checkout converted LF to CRLF in eight original CSVs and `generation_metadata.json`.

For all nine files, the committed blob equals the existing manifest hash; converting its LF bytes to CRLF reproduces the checkout bytes and the exact failed CI hash. The [per-file evidence](validation-2026-11-02/byte-diagnosis.json) records these comparisons.

Commit [`1383f3e`](https://github.com/youmnaeidh/Madinah-Operations-Intelligence/commit/1383f3ef723e6c76c1b2d2364eb6dda28e95aa11) adds only `.gitattributes`: `data/*.csv -text` and `data/generation_metadata.json -text`. This disables checkout/check-in text conversion for the protected source bytes. No original CSV, metadata, reference hash, test or tolerance was changed.

- [Windows job](https://github.com/youmnaeidh/Madinah-Operations-Intelligence/actions/runs/41517009145/job/125523013252): success.
- [Ubuntu job](https://github.com/youmnaeidh/Madinah-Operations-Intelligence/actions/runs/41517009145/job/125523013640): success.
- Both jobs passed 18 tests, compilation, saved-PBIX preservation, independent training, export checks and numerical validation. All 30,000 exported probabilities were checked, with zero score/classification/risk-band mismatches.
- Local Windows validation also passed. All 16 original source/asset manifest entries match. See the [CI summary](validation-2026-11-02/ci-fix-summary.json).

## Scoped technical and visual QA

Independent recomputation confirms 30,000 predictions and 6,057 resolved retrospective test rows: ROC-AUC 0.6870204944679009, Recall 0.8528546203649205, Precision 0.33619489559164734; TP/FP/FN/TN = 1,449 / 2,861 / 250 / 1,497. There are 4,310 review alerts. Higher recall comes with more false alerts; these results do not establish independent production performance.

Capacity is 356,984; demand/nominal capacity is 8.40373798%; Active is 267; High Risk is 3,371; Active High Risk is 39. Original source bytes and exported numeric results remain consistent.

The saved corrected PBIX passes archive checks for four pages, 119 visuals, original positions/sizes/types and protected visual resources. The existing 47/47 DAX checks and interactive Night-filter check remain the recorded Desktop evidence; they were not rerun in this follow-up. Python and archive verification are not a substitute for new DAX execution.

All four current dashboard PNGs and six case-study page renders were inspected. No unintended text clipping, cropped KPI or content overlap was observed. Static exports show scrollbars and therefore do not show every chart/table row. The original composition, colors, map, mountains, backgrounds and icons remain intact.

Documentation now distinguishes historical handoff limitations from the subsequently completed Desktop validation. Synthetic-data, retrospective-evaluation, feature-timing, censoring and false-alert disclosures remain explicit. Cross-platform individual feature importance can shift between collinear inputs; unchanged checks verify predictions, metrics, district summaries and grouped importance within their existing tolerances.

## Outstanding caption and release decision

The Operations card still reads `Capacity Utilization`; the current case-study screenshot repeats it. Its calculation is correct, but the requested `Demand / Nominal Capacity` caption has not been applied.

In the follow-up, Desktop eventually opened through its Windows association and the Operations page was inspected. Caption input did not behave reliably. The working PBIX subsequently contained unrelated pasted text in the target visual's `displayName` and `nativeQueryRef`. Its `DataModel`, `SecurityBindings` and active-page metadata also differed; binary model equivalence was not assumed. This unaccepted candidate was quarantined outside the repository and the known-good working PBIX restored from the clean release checkout. The accepted artifact remains SHA-256 `b551503dbb1273e273eebdf35d3fd5308d29494c4573e803996ef7e3f6391922`.

Desktop control then timed out even on window inventory after runtime reset. A host probe showed approximately 14 MB free physical memory out of 8 GB, a possible contributor rather than a proven sole cause. No valid caption correction, new DAX test or PDF/screenshot export is claimed. The release PBIX/PDF/PNG files remain the previously verified versions.

The project can be shown as a synthetic portfolio prototype with this explicit caption limitation. PR #1 is ready for review of the CI/documentation changes, but the requested final release is not fully complete: edit the caption in Desktop, preserve the card's geometry/style/value, save and reopen the PBIX, verify the relevant calculation and filters, re-export the dashboard and affected case-study preview, and inspect the final outputs. Merge still requires the owner's explicit approval.
