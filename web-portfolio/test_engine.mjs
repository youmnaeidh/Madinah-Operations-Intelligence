import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { hydrate, summarize, priorityQueue } from "./dist/engine.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, "..");
const json = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8").replace(/^\uFEFF/, ""));
const data = hydrate(json("web-portfolio/dist/assets/data.json"));
let checks = 0;
function equal(actual, expected, label) {
  checks++;
  if (
    expected === null
      ? actual !== null
      : typeof expected === "number"
        ? typeof actual !== "number" ||
          !Number.isFinite(actual) ||
          Math.abs(actual - expected) > 1e-10
        : actual !== expected
  )
    throw Error(`${label}: ${actual} != ${expected}`);
}
const reference = JSON.parse(
  gunzipSync(readFileSync(resolve(here, "tests/power-bi-reference.json.gz"))),
);
const baseline = reference.kpis[0],
  s = summarize(data);
const keys = {
  incoming: "Incoming",
  resolved: "Resolved",
  open: "Open",
  inProgress: "InProgress",
  active: "Active",
  slaMet: "SLAMetResolved",
  sla: "SLACompliance",
  median: "MedianResolutionHours",
  repeat: "RepeatRate",
  assignment: "AssignmentDelay",
  capacity: "NominalCapacity",
  demandRatio: "DemandNominal",
  scenarioCapacity: "ScenarioCapacity",
  high: "HighRisk",
  activeHigh: "ActiveHighRisk",
  meanRisk: "MeanRisk",
  recall: "Recall",
  rocAuc: "ROCAUC",
  threshold: "Threshold",
};
for (const [key, field] of Object.entries(keys))
  equal(s[key], baseline[`[${field}]`], field);
const contexts = {
  All: {},
  Category: { category: 1 },
  Channel: { channel: 1 },
  Team: { team: 1 },
  Hour: { hour: 18 },
  TimeBand: { timeBand: "Evening" },
  HourLabel: { hour: 18 },
  Open: { status: "Open" },
  InProgress: { status: "In Progress" },
  Resolved: { status: "Resolved" },
  DimTimeEvening: { shift: "Evening" },
  DimShiftEvening: { shift: "Evening" },
  Central: { district: 1 },
  AprilPartial: { start: "2026-04-01", end: "2026-04-05" },
};
for (const row of reference.contexts) {
  const name = row["[Context]"],
    v = summarize(data, contexts[name]);
  equal(v.capacity, row["[Capacity]"], `${name} capacity`);
  equal(v.recall, row["[Recall]"], `${name} recall`);
  equal(v.activeHigh, row["[ActiveHighRisk]"] ?? 0, `${name} active high`);
}
const groups = new Map();
for (const r of data.rows) {
  const key = [r.date, r.district, r.shift].join("|");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
const capacities = new Map(
  data.capacity.map((r) => [[r[0], r[1], r[2]].join("|"), r[5]]),
);
const grain = reference.grain;
for (const r of grain) {
  const key = [
      r["DimDate[DateKey]"],
      r["DimDistrict[DistrictKey]"],
      r["DimShift[Shift]"],
    ].join("|"),
    rows = groups.get(key) || [];
  equal(rows.length, r["[Incoming]"] ?? 0, `${key} incoming`);
  equal(capacities.get(key), r["[Capacity]"], `${key} capacity`);
  equal(
    rows.filter((x) => x.risk >= 0.4 && x.status !== "Resolved").length,
    r["[ActiveHighRisk]"] ?? 0,
    `${key} active high`,
  );
  equal(
    rows.length ? rows.reduce((n, x) => n + x.risk, 0) / rows.length : null,
    r["[MeanRisk]"],
    `${key} mean risk`,
  );
  equal(data.metrics.test.recall, r["[Recall]"], `${key} recall`);
}
const predictions = reference.predictions,
  byId = new Map(data.rows.map((r) => [r.id, r]));
equal(byId.size, 30000, "unique IDs");
equal(predictions.length, 30000, "prediction rows");
for (const p of predictions) {
  const r = byId.get(p["[IncidentID]"]);
  equal(
    Object.is(r.risk, p["[Probability]"]),
    true,
    r.id + " exact probability",
  );
  equal(r.status, p["[Status]"], r.id + " status");
}
const queue = priorityQueue(data);
equal(queue.length, 39, "priority queue");
equal(
  queue.every((r) => r.status !== "Resolved" && r.risk >= 0.4),
  true,
  "queue eligibility",
);
const manifest = json("web-portfolio/data-manifest.json"),
  sha = (p) =>
    createHash("sha256")
      .update(readFileSync(resolve(root, p)))
      .digest("hex");
const checkSource = process.argv.includes("--check-source");
if (checkSource)
  for (const [path, hash] of Object.entries(manifest.sourceFiles))
    equal(sha(path), hash, path + " unchanged");
equal(
  sha("web-portfolio/dist/assets/madinah-map.png"),
  manifest.mapSha256,
  "original map unchanged",
);
equal(
  sha("web-portfolio/dist/downloads/madinah-operations.pbix"),
  manifest.sourceFiles[
    "output\\Madinah Operations Intelligence - Updated.pbix"
  ],
  "PBIX download exact",
);
const report = {
  passed: true,
  checks,
  incidents: data.rows.length,
  grainContexts: grain.length,
  filterContexts: Object.keys(contexts).length,
  priorityQueue: queue.length,
  predictionsCompared: predictions.length,
  predictionComparison: "exact binary64",
  aggregateTolerance: 1e-10,
  checkedAt: new Date().toISOString(),
  baseline: "Power BI reopened verification, 2026-10-24",
  sourceFilesUnchanged: checkSource
    ? true
    : "not requested; use --check-source in original workspace",
  mapUnchanged: true,
};
writeFileSync(
  resolve(here, "validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
