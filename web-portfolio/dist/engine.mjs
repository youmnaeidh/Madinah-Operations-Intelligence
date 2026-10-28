// One calculation layer shared by the UI and parity checks against Power BI.
export function hydrate(data) {
  data.rows = data.incidents.map((values) =>
    Object.fromEntries(data.columns.map((key, i) => [key, values[i]])),
  );
  return data;
}
export const dateKey = (value) =>
  value ? Number(value.replaceAll("-", "")) : null;
export const isoDate = (value) =>
  String(value).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
export function filtered(data, f = {}) {
  return data.rows.filter(
    (r) =>
      (!f.start || r.date >= dateKey(f.start)) &&
      (!f.end || r.date <= dateKey(f.end)) &&
      (!f.district || r.district === Number(f.district)) &&
      (!f.category || r.category === Number(f.category)) &&
      (!f.shift || r.shift === f.shift) &&
      (!f.status || r.status === f.status) &&
      (f.hour == null || f.hour === "" || r.hour === Number(f.hour)) &&
      (!f.channel || r.channel === Number(f.channel)) &&
      (!f.team || r.team === Number(f.team)) &&
      (!f.timeBand || r.timeBand === f.timeBand),
  );
}
export function capacityRows(data, f = {}) {
  if (
    f.category ||
    f.channel ||
    f.team ||
    f.timeBand ||
    (f.hour != null && f.hour !== "")
  )
    return null;
  return data.capacity.filter(
    (r) =>
      (!f.start || r[0] >= dateKey(f.start)) &&
      (!f.end || r[0] <= dateKey(f.end)) &&
      (!f.district || r[1] === Number(f.district)) &&
      (!f.shift || r[2] === f.shift),
  );
}
const ratio = (a, b) => (b ? a / b : null);
const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0);
export function median(values) {
  if (!values.length) return null;
  const s = values.toSorted((a, b) => a - b),
    i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}
export function summarize(data, f = {}, givenRows = null) {
  const rows = givenRows ?? filtered(data, f),
    resolved = rows.filter((r) => r.status === "Resolved"),
    active = rows.filter((r) => r.status !== "Resolved"),
    high = rows.filter((r) => r.risk >= 0.4),
    cap = capacityRows(data, f);
  const available = cap ? sum(cap, 4) : null,
    planned = cap ? sum(cap, 3) : null,
    nominal = cap ? sum(cap, 5) : null;
  const days = cap ? new Set(cap.map((r) => r[0])).size : 0;
  const met = resolved.filter((r) => r.sla).length;
  return {
    incoming: rows.length,
    resolved: resolved.length,
    open: rows.filter((r) => r.status === "Open").length,
    inProgress: rows.filter((r) => r.status === "In Progress").length,
    active: active.length,
    slaMet: met,
    breached: resolved.length - met,
    sla: ratio(met, resolved.length),
    median: median(resolved.map((r) => r.resolution)),
    repeat: ratio(rows.filter((r) => r.repeat).length, rows.length),
    assignment: rows.length
      ? rows.reduce(
          (n, r) =>
            n +
            (Date.parse(r.assigned.replace(" ", "T") + "Z") -
              Date.parse(r.created.replace(" ", "T") + "Z")) /
              3600000,
          0,
        ) / rows.length
      : null,
    capacity: nominal,
    demandRatio: nominal === null ? null : ratio(rows.length, nominal),
    availability: cap ? ratio(available, planned) : null,
    avgPlanned: cap ? ratio(planned, days) : null,
    avgAvailable: cap ? ratio(available, days) : null,
    high: high.length,
    activeHigh: high.filter((r) => r.status !== "Resolved").length,
    meanRisk: rows.length ? sum(rows, "risk") / rows.length : null,
    recall: data.metrics.test.recall,
    rocAuc: data.metrics.test.roc_auc,
    threshold: data.metrics.threshold,
    scenarioCapacity: null,
  };
}
export function groupCounts(rows, key) {
  const result = new Map();
  for (const row of rows) result.set(row[key], (result.get(row[key]) || 0) + 1);
  return result;
}
export function priorityQueue(data, f = {}) {
  return filtered(data, f)
    .filter((r) => r.status !== "Resolved" && r.risk >= 0.4)
    .toSorted((a, b) => b.risk - a.risk || a.id.localeCompare(b.id));
}
export function monthly(data, f = {}) {
  const months = [
    ...new Set(
      data.dates
        .filter(
          (d) =>
            (!f.start || d >= dateKey(f.start)) &&
            (!f.end || d <= dateKey(f.end)),
        )
        .map((d) => String(d).slice(0, 6)),
    ),
  ];
  const rows = filtered(data, f),
    cap = capacityRows(data, f);
  return months.map((month) => ({
    month,
    incoming: rows.filter((r) => String(r.date).startsWith(month)).length,
    capacity: cap
      ? cap
          .filter((r) => String(r[0]).startsWith(month))
          .reduce((n, r) => n + r[5], 0)
      : null,
  }));
}
