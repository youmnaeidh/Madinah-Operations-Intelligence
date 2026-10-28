# Madinah Operations Intelligence — web portfolio

A custom Arabic / English dashboard in green and gold. Plain HTML, CSS and JavaScript modules; no framework, cloud builder, API keys or runtime packages.

## Run in VS Code

Open this folder in VS Code. Requires Node.js 22 or newer. In the terminal:

```sh
node server.mjs
```

Open **http://127.0.0.1:8766**. Stop with Ctrl+C. The server listens only on your own device. No dependency installation or build is needed. VS Code also includes **Tasks: Run Task → Preview dashboard**.

## Edit

- `dist/index.html`: entry page and metadata.
- `dist/app.mjs`: four pages, Arabic / English copy, interactions and animation.
- `dist/engine.mjs`: filtering and calculations, shared with validation.
- `dist/style.css`: responsive green/gold theme, RTL and reduced motion.
- `dist/assets/data.json`: packaged synthetic records and model scores.
- `dist/assets/madinah-map.png`: original terrain asset, byte-for-byte preserved.
- `dist/downloads/`: verified Power BI report, dashboard PDF and case-study PDF.

The four views cover city demand, operations and SLA, risk review, and the project story. Filter by date, district, shift, service category or hour. Click map markers and chart categories, search the active high-risk queue, and open incident details. Language and motion preferences are saved on the device.

## Verify

```sh
node test_engine.mjs
node --check dist/app.mjs
node --check dist/engine.mjs
```

The compressed `tests/power-bi-reference.json.gz` contains captured DAX query results from the verified Power BI delivery. It is an independent baseline, not generated from the web calculation code. Tests compare 30,000 prediction probabilities exactly, 6,588 date/district/shift groups, 14 filter contexts and the headline measures. Blank DAX counts display as zero; undefined ratios and unsupported capacity contexts remain blank. The map and downloadable PBIX hashes are checked too.

`validation.json` records the latest completed checks. The optional `--check-source` flag also verifies the original CSV/PBIX source hashes when this folder is in the original Desktop delivery workspace. Public tests do not require Power BI Desktop.

## Data and limits

Data period: 5 October 2025–5 April 2026. This is a **synthetic, retrospective portfolio**, not a live municipality service. It contains 30,000 reports, 267 active reports and 39 active high-risk reports at probability ≥40%. Nominal capacity is 356,984; category/hour selections cannot allocate that capacity. Model recall (85.3%) and ROC-AUC (68.7%) come from the fixed test set and do not change under dashboard filters. Precision is 33.6%; recall is not accuracy. All-row scores include training records.

The model review threshold (24%) and high-risk band (40%) serve different purposes. Source priority is distinct from predicted risk. Human review is required. District markers are illustrative positions on the preserved background.

`build_data.py` repackages existing corrected CSV/model exports and verified local `output/` deliverables. It never trains a model or edits the PBIX. The packaged website is already ready to run; regeneration requires those verified source artifacts.

## GitHub hosting

Source branch: `codex/web-portfolio-2026-10-28` in `youmnaeidh/Madinah-Operations-Intelligence`.

The publishing folder is `/docs` on that branch. `node prepare-pages.mjs` copies the static output there. Commit both source changes and the regenerated `docs/`, then push the same branch to update GitHub Pages. The deployment does not require merging PR #1 or changing `main` or the backup branch.

Author: **Yomna Alhejaili**. Independent portfolio inspired by municipal operations experience. Existing project assets retain their original attribution.
