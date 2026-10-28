# Web verification — 28 October 2026

## Calculations and preserved assets

`node test_engine.mjs` passes 93,007 checks in the Git checkout. The original delivery workspace passes 93,011 with `--check-source`, which adds four original-file hash checks.

- 30,000 probabilities match captured Power BI results exactly at binary64 precision.
- Headline measures, 6,588 date/district/shift groups and 14 filter contexts match.
- The priority queue contains 39 active records with risk ≥40%.
- The original terrain image and the downloaded final PBIX match recorded hashes.
- No Power BI source, backup branch or remediation branch is modified by the web build.

## Browser checks completed

Tested in the Chromium-based in-app browser at its normal desktop viewport and a 390 × 844 mobile viewport:

- Four-page navigation, Arabic/English and RTL/LTR switching.
- District/category/shift filtering; category capacity suppression; reset controls.
- Keyboard activation of hourly chart filters (18:00 gives 1,953 reports).
- Priority-queue pagination, ID search, empty results and incident-detail drawer.
- Escape dismissal of incident details, metric definitions, and motion toggle.
- Mobile navigation opens, switches page and closes; Arabic tables stay within their horizontal scroll containers.
- Original map aspect ratio retained on mobile.
- All eight local entry/code/data/download endpoints return HTTP 200 with their expected content types.
- Node preview server rejects a path traversal request.

Screenshots are in `screenshots/`. This is not a comprehensive accessibility certification or a Safari/Firefox/device-lab compatibility claim. Native date controls follow the operating system's locale.

## Scope

Static synthetic-data demonstration. No live data feed, backend, login, automatic dispatch or model retraining is provided. The existing model's limits remain visible in the project page. Future data refreshes must use the corrected source pipeline and repeat the parity checks.
