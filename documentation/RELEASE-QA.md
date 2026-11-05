# Final CI and release QA

The Windows CI defect and the 8.4% card caption are fixed. The saved final PBIX was reopened, checked in Desktop and exported again. PR #1 remains open and unmerged.

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

The saved corrected PBIX passes archive checks for four pages, 119 visuals, original positions/sizes/types and protected visual resources. All 47 DAX engine checks were rerun successfully on 4 November, including after reopening the saved PBIX. The interactive Night-filter check remains separately recorded in the 2 November evidence. Python and archive verification are not a substitute for DAX execution.

All four current dashboard PNGs and six case-study page renders were inspected. No unintended text clipping, cropped KPI or content overlap was observed. The case-study update replaces only the Operations image on page 4; all six pages retain their text, drawing instructions and unrelated images. The reviewed exports were installed on 5 November; [export evidence](validation-2026-11-04/export-verification.json) records their hashes. Static exports show scrollbars and therefore do not show every chart/table row. The original composition, colors, map, mountains, backgrounds and icons remain intact.

Documentation now distinguishes historical handoff limitations from the subsequently completed Desktop validation. Synthetic-data, retrospective-evaluation, feature-timing, censoring and false-alert disclosures remain explicit. Cross-platform individual feature importance can shift between collinear inputs; unchanged checks verify predictions, metrics, district summaries and grouped importance within their existing tolerances.

## Caption completion and release decision — 4 November 2026

The Operations card now displays the full `Demand / Nominal Capacity` caption on two lines. Native label wrapping keeps the original font, colors, card size and position. Its value remains 8.4%, backed by the unchanged 30,000 / 356,984 calculation (8.40373798%).

A fresh PBIP was saved from the accepted report in Desktop. Only the target visual's display name was edited in that project; label wrapping was enabled in Desktop. The project was then saved as PBIX, closed and reopened. Desktop 2.159.1231.0 passed the existing 47-case query on the reopened PBIX and produced a new four-page PDF.

The report archive differs only in the target card's `displayName` and `textWrap` properties. The other 118 visuals, page metadata, filters, bookmarks and static resources are byte-identical to the accepted previous report. All 23 semantic files covering tables/measures, M expressions, relationships and model/database definitions are unchanged. Desktop regenerated linguistic metadata and serialized the binary model/security bindings; binary model equivalence is not asserted. Live DAX results provide separate engine evidence.

The final native save was additionally reopened on 5 November and passed all 47 DAX checks. Its report definitions/resources match the 4 November export; only DataModel and SecurityBindings bytes differ from the earlier saved candidate. The earlier unsuccessful UI-input candidate was quarantined and never published. The final accepted PBIX is SHA-256 `70622b34c2b60991de23ddd12d63229c8020229e48dbce2ea77f3aea5de8b646`. See [Desktop evidence](validation-2026-11-04/desktop-validation.json) and [preservation checks](validation-2026-11-04/caption-preservation.json).

The project is suitable for a portfolio as a synthetic-data prototype with retrospective evaluation and human review. PR #1 is ready for final review subject to successful checks on its latest commit. Production, Power BI Service/gateway/RLS and exhaustive interaction combinations remain outside the tested scope. Merge still requires the owner's explicit approval.
