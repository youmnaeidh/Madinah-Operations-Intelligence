import {
  hydrate,
  filtered,
  summarize,
  capacityRows,
  priorityQueue,
  monthly,
  groupCounts,
  dateKey,
  isoDate,
} from "./engine.mjs";

const app = document.querySelector("#app");
const store = {
  get: (k, d) => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};
const state = {
  lang: store.get("moi-lang", "en"),
  page: "overview",
  filters: {
    start: "2025-10-05",
    end: "2026-04-05",
    district: "",
    category: "",
    shift: "",
    hour: "",
  },
  mapMode: "reports",
  search: "",
  queuePage: 0,
  motion: store.get("moi-motion", "on") === "on",
  menu: false,
};
let data,
  rows,
  stats,
  viewCount = 0,
  lastFocus = null;
const T = (en, ar) => (state.lang === "ar" ? ar : en);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const name = (o) => o?.[state.lang] || o?.en || "";
const n = (x, d = 0) =>
  x == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(x);
const pct = (x, d = 1) => (x == null ? "—" : n(x * 100, d) + "%");
const district = (id) => data.districts.find((x) => x.id === Number(id));
const category = (id) => data.categories.find((x) => x.id === Number(id));
const words = {
  Morning: ["Morning", "صباحًا"],
  Evening: ["Evening", "مساءً"],
  Night: ["Night", "ليلًا"],
  Resolved: ["Resolved", "محلول"],
  Open: ["Open", "مفتوح"],
  "In Progress": ["In progress", "قيد التنفيذ"],
  High: ["High", "مرتفع"],
  Medium: ["Medium", "متوسط"],
  Low: ["Low", "منخفض"],
  Moderate: ["Moderate", "متوسط"],
  Central: ["Central", "المركز"],
  East: ["East", "الشرق"],
  West: ["West", "الغرب"],
  North: ["North", "الشمال"],
  South: ["South", "الجنوب"],
  Train: ["Training", "التدريب"],
  Validation: ["Validation", "التحقق"],
  Test: ["Test", "الاختبار"],
  "Active Scored": ["Active, scored", "نشط، تم تقييمه"],
  "Label Unavailable at Cutoff": [
    "Label unavailable at cutoff",
    "النتيجة غير متاحة عند الحد الزمني",
  ],
};
const word = (s) => (words[s] ? T(...words[s]) : s);
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  chart: "M4 20V10m8 10V4m8 16v-7M2 21h20",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  book: "M4 3h12l4 4v14H4z M15 3v5h5M8 12h8M8 16h6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  reports: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  clock: "M12 8v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  repeat:
    "M4 8a8 8 0 0 1 14-2l2 2M20 3v5h-5M20 16a8 8 0 0 1-14 2l-2-2M4 21v-5h5",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  reset: "M3 10a9 9 0 1 1 1 8M3 4v6h6",
  download: "M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6",
  link: "M9 15l6-6m-7 3-2 2a4 4 0 0 0 6 6l2-2m-2-12 2-2a4 4 0 0 1 6 6l-2 2",
  search: "M18 18l4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  play: "m8 4 12 8-12 8z",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m16-7a4 4 0 0 1 4 4v3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-3a4 4 0 0 1 0 8",
  target:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M13 12h-2",
  check: "m5 12 4 4L20 5",
  layers: "m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6",
};
const icon = (key, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key] || paths.grid}"/></svg>`;
const titles = {
  overview: ["City overview", "نظرة على المدينة"],
  operations: ["Operations & SLA", "العمليات ومستوى الخدمة"],
  ai: ["AI insights", "رؤى الذكاء الاصطناعي"],
  project: ["About the project", "عن المشروع"],
};
const note = (en, ar) => `<p class="muted small">${T(en, ar)}</p>`;
const pill = (text, cls = "") => `<span class="pill ${cls}">${text}</span>`;
const empty = () =>
  `<div class="empty">${icon("search")}<strong>${T("No reports in this selection", "لا توجد بلاغات ضمن هذا الاختيار")}</strong><span>${T("Try another period or reset your filters.", "جرّب فترة أخرى أو أعد ضبط الفلاتر.")}</span><button class="text-btn" data-action="reset">${T("Reset filters", "إعادة ضبط الفلاتر")}</button></div>`;

function shell() {
  return `<div class="app-shell ${state.menu ? "menu-open" : ""}"><aside class="sidebar" aria-label="${T("Main navigation", "التنقل الرئيسي")}">
 <a class="brand" href="#overview" aria-label="Madinah Operations Intelligence"><img src="./assets/mark.svg" width="43" height="43" alt=""><span>MADINAH<small>OPERATIONS INTELLIGENCE</small></span></a>
 <div class="nav-caption">${T("WORKSPACE", "مساحة التحليل")}</div><nav>${Object.entries(
   titles,
 )
   .map(
     ([key, label], i) =>
       `<button class="nav-item ${state.page === key ? "active" : ""}" data-page="${key}" ${state.page === key ? 'aria-current="page"' : ""}>${icon(["grid", "chart", "spark", "book"][i])}<span>${T(...label)}</span>${state.page === key ? "<i></i>" : ""}</button>`,
   )
   .join("")}</nav>
 <div class="sidebar-story"><div class="orbit-mark">${icon("spark")}</div><span class="eyebrow">${T("BEHIND THE NUMBERS", "وراء الأرقام")}</span><h3>${T("From reports<br>to better questions.", "من البلاغات<br>إلى أسئلة أدق.")}</h3><p>${T("Explore the thinking behind the dashboard.", "اكتشف المنهجية وراء لوحة المعلومات.")}</p><button data-page="project" class="text-btn">${T("Read the story", "قصة المشروع")} ${icon("arrow")}</button></div>
 <div class="sidebar-bottom"><span class="status-dot"></span>${T("Synthetic data · Portfolio", "بيانات اصطناعية · بورتفوليو")}<a class="author" href="https://github.com/youmnaeidh" target="_blank" rel="noopener noreferrer"><span class="avatar">YA</span><span>Yomna Alhejaili<small>${T("Data & BI Analyst", "تحليل البيانات وذكاء الأعمال")}</small></span>${icon("link")}</a></div></aside>
 <div class="workspace"><header class="topbar"><div class="breadcrumbs"><button class="icon-btn mobile-menu" data-action="menu" aria-label="${T("Toggle navigation", "فتح القائمة")}" aria-expanded="${state.menu}">${icon("menu")}</button><span>MOI</span><span class="divider">/</span><strong>${T(...titles[state.page])}</strong></div><div class="top-actions"><span class="snapshot"><span></span>${T("Portfolio preview", "معاينة المشروع")}</span><button class="icon-btn" data-action="motion" title="${T("Toggle motion", "تفعيل أو تقليل الحركة")}" aria-label="${T("Motion", "الحركة")}" aria-pressed="${state.motion}">${icon(state.motion ? "spark" : "moon")}</button><button class="lang-btn" data-action="language" lang="${state.lang === "en" ? "ar" : "en"}">${state.lang === "en" ? "العربية" : "English"}</button></div></header>
 <main id="main" tabindex="-1">${heading()}${state.page !== "project" ? filters() : ""}<div id="page-content" class="page-content">${{ overview: overview, operations: operations, ai: ai, project: project }[state.page]()}</div><footer class="footer"><span>© ${new Date().getFullYear()} Yomna Alhejaili · ${T("Independent portfolio project", "مشروع بورتفوليو مستقل")}</span><span>${T("Synthetic data. Human judgment comes first.", "بيانات اصطناعية. الحكم البشري أولًا.")}</span></footer></main></div></div>`;
}
function heading() {
  const subtitles = {
    overview: ["A clearer view of Madinah.", "صورة أوضح للمدينة."],
    operations: [
      "Understand demand. Read the context.",
      "افهم الطلب. واقرأ السياق.",
    ],
    ai: [
      "See the risk. Keep the human perspective.",
      "استكشف المخاطر. واحتفظ بالمنظور البشري.",
    ],
    project: ["The thinking behind the intelligence.", "المنهجية وراء الرؤى."],
  };
  const descriptions = {
    overview: [
      "Explore demand, service performance and the reports that need attention.",
      "استكشف الطلب وأداء الخدمات والبلاغات التي تحتاج إلى المراجعة.",
    ],
    operations: [
      "Compare report volumes with nominal capacity across districts and shifts.",
      "قارن أعداد البلاغات بالسعة الاسمية عبر الأحياء والورديات.",
    ],
    ai: [
      "Retrospective risk scores to support review, not automate decisions.",
      "درجات مخاطر استعادية لدعم المراجعة، وليست لاتخاذ القرارات تلقائيًا.",
    ],
    project: [
      "A municipal operations portfolio built around transparent, testable analysis.",
      "مشروع تحليلي للعمليات البلدية مبني على الوضوح والتحقق.",
    ],
  };
  return `<section class="page-heading"><div><div class="eyebrow gold">${T("MADINAH / OPERATIONS INTELLIGENCE", "المدينة المنورة / ذكاء العمليات")}</div><h1>${T(...subtitles[state.page])}</h1><p>${T(...descriptions[state.page])}</p></div><a class="button secondary" href="./downloads/case-study.pdf" target="_blank" rel="noopener">${icon("book")}${T("Case study", "دراسة الحالة")}${icon("arrow")}</a></section>`;
}
function filters() {
  const select = (key, label, options) =>
    `<label class="filter-select"><span>${label}</span><select id="filter-${key}" data-filter="${key}" aria-label="${label}"><option value="">${T("All", "الكل")}</option>${options.map(([id, text]) => `<option value="${id}" ${String(state.filters[key]) === String(id) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  return `<section class="filter-bar" aria-label="${T("Dashboard filters", "فلاتر لوحة المعلومات")}"><div class="filter-symbol">${icon("filter")}</div><div class="date-filter"><label for="filter-start">${T("Date range", "الفترة الزمنية")}</label><div><input id="filter-start" type="date" min="2025-10-05" max="2026-04-05" data-filter="start" value="${state.filters.start}" aria-label="${T("Start date", "تاريخ البداية")}"><span>—</span><input id="filter-end" type="date" min="2025-10-05" max="2026-04-05" data-filter="end" value="${state.filters.end}" aria-label="${T("End date", "تاريخ النهاية")}"></div></div>${select(
    "district",
    T("District", "الحي"),
    data.districts.map((d) => [d.id, name(d)]),
  )}${select(
    "shift",
    T("Shift", "الوردية"),
    ["Morning", "Evening", "Night"].map((v) => [v, word(v)]),
  )}${select(
    "category",
    T("Service category", "فئة الخدمة"),
    data.categories.map((d) => [d.id, name(d)]),
  )}<button class="icon-btn reset" data-action="reset" aria-label="${T("Reset all filters", "إعادة ضبط جميع الفلاتر")}" title="${T("Reset all filters", "إعادة ضبط جميع الفلاتر")}">${icon("reset")}</button></section><div class="selection-summary" aria-live="polite"><span>${n(stats.incoming)} ${T("reports in view", "بلاغًا ضمن العرض")}${state.filters.district ? " · " + name(district(state.filters.district)) : ""}</span>${state.filters.hour !== "" ? `<button class="chip" data-action="clear-hour">${T("Hour", "الساعة")} ${state.filters.hour}:00 ${icon("close")}</button>` : ""}<span>${T("05 Oct 2025 — 05 Apr 2026 · Synthetic snapshot", "5 أكتوبر 2025 — 5 أبريل 2026 · بيانات اصطناعية")}</span></div>`;
}
const metricDefinitions = {
  incoming: [
    "All incident records matching the selected filters.",
    "جميع سجلات البلاغات المطابقة للفلاتر المحددة.",
  ],
  sla: [
    "Resolved reports meeting SLA ÷ all resolved reports. Active reports are excluded from this denominator.",
    "البلاغات المحلولة ضمن المهلة ÷ جميع البلاغات المحلولة. لا تدخل البلاغات النشطة في المقام.",
  ],
  median: [
    "Median recorded ResolutionHours for resolved reports. This is not assignment delay or first-response time.",
    "وسيط ساعات الحل المسجلة للبلاغات المحلولة. ليس زمن الإسناد أو الاستجابة الأولى.",
  ],
  repeat: [
    "Repeat reports ÷ all reports in the selection.",
    "البلاغات المتكررة ÷ جميع البلاغات ضمن الاختيار.",
  ],
  capacity: [
    "Sum of nominal incident capacity at date/district/shift grain. Synthetic capacity is not validated field productivity. Category or hour filters are unsupported.",
    "مجموع السعة الاسمية على مستوى التاريخ والحي والوردية. السعة الاصطناعية ليست إنتاجية ميدانية متحققة. تصفيات الفئة والساعة غير مدعومة.",
  ],
  demandRatio: [
    "Incoming reports ÷ nominal incident capacity. No legacy 12% allocation is applied.",
    "البلاغات الواردة ÷ السعة الاسمية. لا يُطبق معامل التخصيص التاريخي 12%.",
  ],
  availability: [
    "Sum of available team allocations ÷ sum of planned allocations. These are not counts of unique people or teams.",
    "مجموع تخصيصات الفرق المتاحة ÷ المخططة. هذه ليست أعداد أفراد أو فرق فريدة.",
  ],
  active: [
    "Open + In Progress. There are 2 Open and 265 In Progress in the full snapshot.",
    "المفتوح + قيد التنفيذ. البيانات الكاملة تضم بلاغين مفتوحين و265 قيد التنفيذ.",
  ],
  meanRisk: [
    "Mean incident-level score in this selection. All-row scores include training records and are not held-out performance.",
    "متوسط درجة المخاطر للبلاغات المختارة. تتضمن الدرجات الكاملة بيانات تدريب وليست أداء اختبار مستقل.",
  ],
  high: [
    "All selected reports with probability ≥ 40%, regardless of their status.",
    "جميع البلاغات المختارة بدرجة مخاطر 40% فأكثر، بغض النظر عن الحالة.",
  ],
  activeHigh: [
    "Open or In Progress AND probability ≥ 40%. This differs from the 24% review flag.",
    "مفتوح أو قيد التنفيذ ودرجة المخاطر 40% فأكثر. يختلف ذلك عن علامة المراجعة عند 24%.",
  ],
  recall: [
    "Test true positives ÷ all actual test breaches. Evaluated on 6,057 resolved test rows; independent of dashboard filters. Recall is not accuracy.",
    "الإيجابيات الصحيحة ÷ التجاوزات الفعلية في الاختبار. محسوب على 6,057 سجلًا محلولًا، ولا يتغير بفلاتر التقرير. الاستدعاء ليس الدقة الكلية.",
  ],
};
function metric(key, title, value, format, subtitle, glyph, tone = "teal") {
  const val =
    format === "percent"
      ? pct(value)
      : format === "hours"
        ? n(value, 1)
        : n(value);
  return `<article class="metric-card ${tone}"><div class="metric-top"><span>${title}</span><button class="info-btn" data-info="${key}" aria-label="${T("Definition: ", "تعريف: ") + title}">${icon("info")}</button></div><div class="metric-main"><strong data-value="${value ?? ""}" data-format="${format}" aria-label="${val}">${val}</strong>${format === "hours" ? `<span class="unit">${T("hrs", "ساعة")}</span>` : ""}<span class="metric-glyph">${icon(glyph)}</span></div><div class="metric-foot"><span class="tiny-dot"></span>${subtitle}</div></article>`;
}
function panelHead(title, subtitle, extra = "") {
  return `<div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${extra}</div>`;
}
function overview() {
  const counts = groupCounts(rows, "hour");
  const peak = [...counts].sort((a, b) => b[1] - a[1])[0];
  const categories = data.categories
    .map((d) => ({
      id: d.id,
      label: name(d),
      value: rows.filter((r) => r.category === d.id).length,
    }))
    .sort((a, b) => b.value - a.value);
  return `<div class="metrics-grid">${metric("incoming", T("Incoming reports", "البلاغات الواردة"), stats.incoming, "number", T("Across the selected period", "خلال الفترة المحددة"), "reports")}${metric("sla", T("SLA compliance", "الالتزام بمستوى الخدمة"), stats.sla, "percent", T("Resolved reports only", "البلاغات المحلولة فقط"), "shield")}${metric("median", T("Median resolution", "وسيط زمن الحل"), stats.median, "hours", T("Time to resolution", "الوقت حتى الحل"), "clock", "gold")}${metric("repeat", T("Repeat report rate", "نسبة البلاغات المتكررة"), stats.repeat, "percent", T("Share of incoming reports", "من إجمالي البلاغات الواردة"), "repeat", "gold")}</div>
 <div class="overview-main"><section class="panel map-panel">${panelHead(T("The city at a glance", "المدينة في لمحة"), T("Select a district to explore its reports", "اختر حيًا لاستكشاف بلاغاته"), `<div class="segmented"><button data-map="reports" aria-pressed="${state.mapMode === "reports"}" class="${state.mapMode === "reports" ? "active" : ""}">${T("Reports", "البلاغات")}</button><button data-map="risk" aria-pressed="${state.mapMode === "risk"}" class="${state.mapMode === "risk" ? "active" : ""}">${T("Risk", "المخاطر")}</button></div>`)}${map()}<div class="map-caption"><span>${icon("pin")}${T("Madinah, Saudi Arabia", "المدينة المنورة، المملكة العربية السعودية")}</span><span>${T("Illustrative district positions · Select a marker", "مواقع توضيحية للأحياء · اختر إحدى النقاط")}</span></div></section>${brief()}</div>
 <div class="overview-bottom"><section class="panel hourly">${panelHead(T("The rhythm of demand", "إيقاع الطلب"), T("Incoming reports by hour", "البلاغات الواردة حسب الساعة"), pill(peak ? `${String(peak[0]).padStart(2, "0")}:00 ${T("peak", "الذروة")}` : "—"))}${rows.length ? hourChart(counts) : empty()}</section><section class="panel categories">${panelHead(T("Service demand", "الطلب على الخدمات"), T("Select a category to filter", "اختر فئة لتصفية العرض"))}${bars(categories, "category", false, 8)}</section><section class="panel status-panel">${panelHead(T("SLA status", "حالة مستوى الخدمة"), T("All reports, including active", "جميع البلاغات بما فيها النشطة"))}${donut(
   [
     {
       label: T("Met", "ضمن المهلة"),
       value: stats.slaMet,
       color: "var(--teal)",
     },
     {
       label: T("Breached", "متجاوز للمهلة"),
       value: stats.breached,
       color: "var(--coral)",
     },
     { label: T("Active", "نشط"), value: stats.active, color: "var(--gold)" },
   ],
   stats.incoming,
   T("reports", "بلاغ"),
 )}</section></div>`;
}
function map() {
  const b = data.bounds;
  const items = data.districts.map((d) => {
    const r = rows.filter((x) => x.district === d.id);
    return {
      ...d,
      count: r.length,
      risk: r.length ? r.reduce((s, x) => s + x.risk, 0) / r.length : 0,
    };
  });
  const max = Math.max(1, ...items.map((d) => d.count));
  return `<div class="map-stage" role="group" aria-label="${T("Interactive district map", "خريطة الأحياء التفاعلية")}"><img class="map-image" src="./assets/madinah-map.png" alt="${T("Original Madinah map with mountain terrain", "خريطة المدينة الأصلية وتضاريس الجبال")}" width="1672" height="941"><div class="map-top-label">${pill(T("DISTRICT EXPLORER", "استكشاف الأحياء"))}<span class="map-compass">N ↑</span></div>${items
    .filter((d) => d.count)
    .map((d) => {
      const x = ((d.lon - b.west) / (b.east - b.west)) * 100,
        y = ((b.north - d.lat) / (b.north - b.south)) * 100,
        size = 14 + Math.sqrt(d.count / max) * 23;
      const color =
        state.mapMode === "risk"
          ? d.risk >= 0.4
            ? "#e68d77"
            : d.risk >= 0.25
              ? "#d2b273"
              : "#69bfad"
          : {
              Central: "#51c8b2",
              East: "#cfb37a",
              West: "#a6bcb2",
              North: "#76b9aa",
              South: "#da9280",
            }[d.sector];
      return `<button class="map-point ${d.id === 1 ? "central" : ""}" data-district="${d.id}" style="left:${x}%;top:${y}%;--point-size:${size}px;--point-color:${color}" aria-label="${esc(name(d))}: ${n(d.count)} ${T("reports", "بلاغ")} · ${T("mean risk", "متوسط المخاطر")} ${pct(d.risk)}"><span class="point-core"></span><span class="map-tooltip"><strong>${esc(name(d))}</strong><span>${state.mapMode === "risk" ? pct(d.risk) + " " + T("mean risk", "متوسط المخاطر") : n(d.count) + " " + T("reports", "بلاغ")}</span></span>${d.id === 1 ? `<span class="central-label">${esc(name(d))}</span>` : ""}</button>`;
    })
    .join(
      "",
    )}<div class="map-scale">${state.mapMode === "risk" ? T("Color = mean risk · Size = report volume", "اللون = متوسط المخاطر · الحجم = عدد البلاغات") : T("Marker size represents report volume", "حجم النقطة يعكس عدد البلاغات")}</div></div>`;
}
function brief() {
  const top = data.districts
    .map((d) => ({ d, count: rows.filter((r) => r.district === d.id).length }))
    .sort((a, b) => b.count - a.count)[0];
  const evening = rows.filter((r) => r.timeBand === "Evening").length;
  return `<section class="panel brief-panel"><div class="brief-label">${icon("spark")}<span>${T("OPERATIONAL BRIEF", "ملخص العمليات")}</span></div><div class="brief-feature"><span>${T("Reports awaiting resolution", "بلاغات بانتظار الحل")}</span><strong>${n(stats.active)}<span class="live-ring"></span></strong><small>${n(stats.open)} ${T("open", "مفتوح")} · ${n(stats.inProgress)} ${T("in progress", "قيد التنفيذ")}</small></div><div class="brief-line"></div><div class="brief-insight"><span class="insight-number">01</span><p>${top?.count ? T(`<b>${esc(name(top.d))}</b> accounts for <b>${pct(top.count / rows.length)}</b> of reports in this selection.`, `تستحوذ <b>${esc(name(top.d))}</b> على <b>${pct(top.count / rows.length)}</b> من البلاغات ضمن الاختيار.`) : T("No reports in this selection.", "لا توجد بلاغات ضمن الاختيار.")}</p></div><div class="brief-insight"><span class="insight-number">02</span><p>${T(`<b>${pct(rows.length ? evening / rows.length : null)}</b> of reports arrive during the evening time band.`, `تصل <b>${pct(rows.length ? evening / rows.length : null)}</b> من البلاغات خلال الفترة المسائية.`)}</p></div><div class="priority-callout"><span class="priority-dot"></span><div><strong>${n(stats.activeHigh)} ${T("active high-risk reports", "بلاغًا نشطًا عالي المخاطر")}</strong><small>${T("A starting point for human review", "نقطة بداية للمراجعة البشرية")}</small></div></div><button class="button gold-button full" data-page="ai">${T("Explore priority reports", "استكشف بلاغات الأولوية")}${icon("arrow")}</button></section>`;
}
function bars(items, filterKey, percent = false, limit = 12) {
  const subset = items.slice(0, limit),
    max = Math.max(1e-9, ...subset.map((x) => x.value ?? 0));
  if (!subset.some((x) => (x.value ?? 0) > 0))
    return `<div class="chart-empty">${T("No values for this selection", "لا توجد قيم لهذا الاختيار")}</div>`;
  return `<div class="bar-list">${subset.map((d, i) => `<${filterKey ? "button" : "div"} ${filterKey ? `data-${filterKey}="${d.id}"` : ""} class="bar-row" style="--delay:${i * 25}ms"><div class="bar-label"><span>${esc(d.label)}</span><strong>${percent ? pct(d.value) : n(d.value, d.decimals || 0)}</strong></div><div class="bar-track"><span style="--bar-width:${Math.max(0, ((d.value ?? 0) / max) * 100)}%;${d.color ? "background:" + d.color : ""}"></span></div></${filterKey ? "button" : "div"}>`).join("")}</div>`;
}
function hourChart(counts) {
  const values = Array.from({ length: 24 }, (_, hour) => counts.get(hour) || 0),
    max = Math.max(...values, 1),
    W = 600,
    H = 174,
    pad = 12;
  const coords = values.map((v, i) => [
      pad + (i * (W - pad * 2)) / 23,
      12 + (1 - v / max) * (H - 24),
    ]),
    line = coords.map((p, i) => (i ? "L" : "M") + p.join(",")).join(" "),
    area = `${line} L${W - pad},${H} L${pad},${H}Z`;
  return `<div class="hour-plot"><div class="chart-axis"><span>${n(max)}</span><span>${n(max / 2)}</span><span>0</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Report volume across the 24 hours", "عدد البلاغات عبر ساعات اليوم الأربع والعشرين")}"><defs><linearGradient id="hour-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#67c1aa" stop-opacity=".25"/><stop offset="1" stop-color="#67c1aa" stop-opacity="0"/></linearGradient></defs>${[12, H / 2, H - 12].map((y) => `<path class="grid-line" d="M0 ${y}H${W}"/>`).join("")}<path d="${area}" fill="url(#hour-fill)"/><path class="chart-line" d="${line}" fill="none" stroke="#74c9b5" stroke-width="2.5"/>${coords.map(([x, y], i) => `<g class="hour-point" tabindex="0" role="button" data-hour="${i}" aria-label="${i}:00 · ${n(values[i])} ${T("reports; filter this hour", "بلاغ؛ تصفية هذه الساعة")}"><circle cx="${x}" cy="${y}" r="10" fill="transparent"/><circle cx="${x}" cy="${y}" r="3" fill="#79cfb9"/><title>${i}:00 — ${n(values[i])}</title></g>`).join("")}</svg></div><div class="hour-labels" dir="ltr"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div><div class="chart-bottom"><span>${T("Select an hour to explore its reports", "اختر ساعة لاستكشاف بلاغاتها")}</span><label>${T("Hour", "الساعة")} <select id="filter-hour" data-filter="hour"><option value="">${T("All", "الكل")}</option>${values.map((_, i) => `<option value="${i}" ${String(state.filters.hour) === String(i) ? "selected" : ""}>${String(i).padStart(2, "0")}:00</option>`).join("")}</select></label></div>`;
}
function donut(segments, total, label) {
  let offset = 0;
  const arcs = segments
    .map((s) => {
      const length = total ? (s.value / total) * 100 : 0;
      const html = `<circle cx="80" cy="80" r="63" fill="none" stroke="${s.color}" stroke-width="13" pathLength="100" stroke-dasharray="${Math.max(0, length - 0.8)} ${100 - Math.max(0, length - 0.8)}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"><title>${s.label}: ${n(s.value)}</title></circle>`;
      offset += length;
      return html;
    })
    .join("");
  return `<div class="donut"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="63" fill="none" stroke="#203c32" stroke-width="13"/>${arcs}</svg><div class="donut-center"><strong>${n(total)}</strong><span>${label}</span></div></div><div class="donut-legend">${segments.map((s) => `<div><span><i style="background:${s.color}"></i>${s.label}</span><strong>${pct(total ? s.value / total : 0)}</strong></div>`).join("")}</div>`;
}
function operations() {
  const supported = stats.capacity !== null;
  const ds = data.districts.map((d) => ({
    d,
    s: summarize(data, { ...state.filters, district: d.id }),
  }));
  const visible = state.filters.district
    ? ds.filter((x) => x.d.id === Number(state.filters.district))
    : ds;
  const shifts = ["Morning", "Evening", "Night"]
    .filter((s) => !state.filters.shift || state.filters.shift === s)
    .map((s) => ({
      label: word(s),
      id: s,
      summary: summarize(data, { ...state.filters, shift: s }),
    }));
  return `<div class="metrics-grid">${metric("capacity", T("Nominal incident capacity", "السعة الاسمية للبلاغات"), stats.capacity, "number", T("Synthetic allocation totals", "مجموع التخصيصات الاصطناعية"), "layers", "gold")}${metric("demandRatio", T("Demand / nominal capacity", "الطلب / السعة الاسمية"), stats.demandRatio, "percent", T("A nominal comparison", "مقارنة اسمية"), "chart", "gold")}${metric("availability", T("Team availability", "إتاحة تخصيصات الفرق"), stats.availability, "percent", T("Available / planned allocations", "التخصيصات المتاحة / المخططة"), "users")}${metric("active", T("Active reports", "البلاغات النشطة"), stats.active, "number", T("Open + in progress", "مفتوح + قيد التنفيذ"), "reports")}</div>
 <div class="context-notice ${supported ? "" : "warning"}">${icon("info")}<p>${supported ? T("Capacity is nominal and synthetic. Validate allocation and productivity before making staffing decisions.", "السعة اسمية واصطناعية. تحقّق من التخصيص والإنتاجية قبل اتخاذ قرارات التوظيف.") : T("Capacity is unavailable for category or hour selections: the source only supports date, district and shift. Reset these filters to compare capacity.", "السعة غير متاحة لتصفيات الفئة أو الساعة؛ المصدر يدعم التاريخ والحي والوردية فقط. أعد ضبط هذه الفلاتر لمقارنة السعة.")}</p></div>
 <div class="operations-main"><section class="panel">${panelHead(T("Demand & nominal capacity", "الطلب والسعة الاسمية"), T("Monthly totals · Separate scales · April through 5 April", "إجماليات شهرية · مقياسان منفصلان · أبريل حتى يوم 5"))}${monthlyChart()}</section><section class="panel">${panelHead(T("District comparison", "مقارنة الأحياء"), T("Demand / nominal capacity", "الطلب / السعة الاسمية"))}${
   supported
     ? bars(
         visible
           .map((x) => ({
             id: x.d.id,
             label: name(x.d),
             value: x.s.demandRatio,
           }))
           .sort((a, b) => b.value - a.value),
         "district",
         true,
       )
     : `<div class="unsupported">${icon("layers")}<strong>${T("Capacity grain not supported", "مستوى التصفية غير مدعوم للسعة")}</strong><p>${T("Incident measures remain available.", "تظل مقاييس البلاغات متاحة.")}</p></div>`
 }</section></div>
 <div class="operations-bottom"><section class="panel">${panelHead(T("Daily team allocations", "تخصيصات الفرق اليومية"), T("Daily averages, not unique team counts", "متوسطات يومية، وليست أعداد فرق فريدة"))}<div class="shift-cards">${shifts.map((x) => `<button class="shift-card" data-shift="${x.id}"><span>${word(x.id)}</span><strong>${n(x.summary.avgAvailable, 1)}</strong><small>${T("available / day", "متاح / يوم")}</small><div class="allocation-bar"><i style="width:${x.summary.availability === null ? 0 : Math.min(100, x.summary.availability * 100)}%"></i></div><span class="muted small">${n(x.summary.avgPlanned, 1)} ${T("planned", "مخطط")}</span></button>`).join("")}</div><div class="shift-sla"><h3>${T("SLA compliance by shift", "الالتزام بمستوى الخدمة حسب الوردية")}</h3>${bars(
   shifts.map((x) => ({ id: x.id, label: x.label, value: x.summary.sla })),
   "shift",
   true,
 )}</div></section>
 <section class="panel">${panelHead(T("District operational priorities", "أولويات العمليات حسب الحي"), T("All selected districts · Sorted by active volume", "جميع الأحياء المختارة · مرتبة حسب البلاغات النشطة"))}<div class="table-wrap"><table><thead><tr><th>${T("District", "الحي")}</th><th>${T("Reports", "البلاغات")}</th><th>${T("SLA", "الالتزام")}</th><th>${T("Active", "نشط")}</th><th>${T("Demand / capacity", "الطلب / السعة")}</th></tr></thead><tbody>${visible
   .sort((a, b) => b.s.active - a.s.active)
   .map(
     (x) =>
       `<tr><td><button class="table-link" data-district="${x.d.id}">${name(x.d)}</button></td><td>${n(x.s.incoming)}</td><td>${pct(x.s.sla)}</td><td><span class="number-badge">${n(x.s.active)}</span></td><td>${pct(x.s.demandRatio)}</td></tr>`,
   )
   .join("")}</tbody></table></div></section></div>`;
}
function monthlyChart() {
  const values = monthly(data, state.filters);
  if (!values.length) return empty();
  const W = 680,
    H = 230,
    bottom = 195,
    top = 16,
    maxIncoming = Math.max(1, ...values.map((v) => v.incoming)) * 1.1,
    maxCapacity = Math.max(1, ...values.map((v) => v.capacity || 0)) * 1.1,
    step = (W - 80) / values.length;
  const point = (v, i) => [
    40 + (i + 0.5) * step,
    bottom - ((v.capacity || 0) / maxCapacity) * (bottom - top),
  ];
  return `<div class="legend-inline"><span><i class="teal-bg"></i>${T("Incoming reports · left", "البلاغات الواردة · اليسار")}</span><span><i class="gold-bg"></i>${T("Nominal capacity · right", "السعة الاسمية · اليمين")}</span></div><div class="monthly-chart" dir="ltr"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T("Monthly incoming reports and nominal capacity on separate scales", "البلاغات والسعة الشهرية بمقياسين منفصلين")}">${[0, 0.5, 1].map((v) => `<path class="grid-line" d="M40 ${bottom - v * (bottom - top)}H${W - 40}"/><text x="34" y="${bottom - v * (bottom - top) + 4}" text-anchor="end">${n(v * maxIncoming)}</text>${stats.capacity !== null ? `<text x="${W - 34}" y="${bottom - v * (bottom - top) + 4}" text-anchor="start">${n((v * maxCapacity) / 1000, 0)}K</text>` : ""}`).join("")}${values.map((v, i) => `<g><rect class="month-bar" x="${40 + i * step + step * 0.23}" y="${bottom - (v.incoming / maxIncoming) * (bottom - top)}" width="${step * 0.54}" height="${(v.incoming / maxIncoming) * (bottom - top)}" rx="5" fill="#58aa93"><title>${v.month}: ${n(v.incoming)} ${T("reports", "بلاغ")} · ${n(v.capacity)} ${T("capacity", "سعة")}</title></rect><text x="${40 + (i + 0.5) * step}" y="220" text-anchor="middle">${v.month.slice(0, 4)}-${v.month.slice(4)}</text></g>`).join("")}${
    stats.capacity !== null
      ? `<path class="chart-line" d="${values.map((v, i) => (i ? "L" : "M") + point(v, i).join(",")).join(" ")}" fill="none" stroke="#cfb173" stroke-width="3"/>${values
          .map((v, i) => {
            const [x, y] = point(v, i);
            return `<circle cx="${x}" cy="${y}" r="4" fill="#dfc38b"><title>${v.month}: ${n(v.capacity)} ${T("nominal capacity", "سعة اسمية")}</title></circle>`;
          })
          .join("")}`
      : ""
  }</svg></div><details class="chart-data"><summary>${T("View exact monthly values", "عرض القيم الشهرية الدقيقة")}</summary><div class="table-wrap"><table><thead><tr><th>${T("Month", "الشهر")}</th><th>${T("Reports", "البلاغات")}</th><th>${T("Nominal capacity", "السعة الاسمية")}</th></tr></thead><tbody>${values.map((v) => `<tr><td>${v.month.slice(0, 4)}-${v.month.slice(4)}</td><td>${n(v.incoming)}</td><td>${n(v.capacity)}</td></tr>`).join("")}</tbody></table></div></details>`;
}
function ai() {
  const districts = data.districts
    .filter(
      (d) => !state.filters.district || d.id === Number(state.filters.district),
    )
    .map((d) => ({
      id: d.id,
      label: name(d),
      value: summarize(data, { ...state.filters, district: d.id }).meanRisk,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const band = [
    {
      label: T("Low <25%", "منخفض <25%"),
      value: rows.filter((r) => r.risk < 0.25).length,
      color: "var(--teal)",
    },
    {
      label: T("Moderate 25–<40%", "متوسط 25–<40%"),
      value: rows.filter((r) => r.risk >= 0.25 && r.risk < 0.4).length,
      color: "var(--gold)",
    },
    {
      label: T("High ≥40%", "مرتفع ≥40%"),
      value: stats.high,
      color: "var(--coral)",
    },
  ];
  const driverAr = {
    "Service Category & SLA": "فئة الخدمة ومهلة الحل",
    Location: "الموقع",
    Subcategory: "الفئة الفرعية",
    "Time of Day": "وقت اليوم",
    Priority: "الأولوية",
  };
  return `<div class="metrics-grid">${metric("meanRisk", T("Average predicted risk", "متوسط المخاطر المتوقعة"), stats.meanRisk, "percent", T("All selected incident scores", "درجات جميع البلاغات المختارة"), "target", "gold")}${metric("high", T("High-risk reports", "البلاغات عالية المخاطر"), stats.high, "number", T("Probability ≥40% · All statuses", "الاحتمال ≥40% · جميع الحالات"), "shield", "gold")}${metric("activeHigh", T("Active high-risk reports", "النشط عالي المخاطر"), stats.activeHigh, "number", T("Open or in progress", "مفتوح أو قيد التنفيذ"), "reports", "coral")}${metric("recall", T("Model recall", "استدعاء النموذج"), stats.recall, "percent", T("Test set · Not filter-dependent", "مجموعة الاختبار · مستقل عن الفلاتر"), "spark")}</div>
 <div class="ai-main"><section class="panel">${panelHead(T("Where risk concentrates", "أين تتركز المخاطر"), T("Mean incident score by district", "متوسط درجة البلاغات حسب الحي"))}${bars(districts, "district", true)}</section><section class="panel risk-panel">${panelHead(T("Risk distribution", "توزيع المخاطر"), T("Descriptive score bands", "نطاقات وصفية لدرجات المخاطر"))}${donut(band, stats.incoming, T("scored reports", "بلاغ مُقيّم"))}<div class="threshold-note">${icon("info")}<span>${T("Review flag ≥24% is different from high risk ≥40%.", "علامة المراجعة ≥24% تختلف عن المخاطر العالية ≥40%.")}</span></div></section><section class="panel drivers">${panelHead(T("What the model uses", "ما يعتمد عليه النموذج"), T("Global feature importance", "أهمية المتغيرات على مستوى النموذج"))}${bars(
   data.drivers.map((d) => ({
     label: state.lang === "ar" ? driverAr[d.name] : d.name,
     value: d.importance,
   })),
   null,
   true,
 )}${note("Staffing features are excluded. Global importance does not explain an individual prediction.", "تم استبعاد خصائص تخصيص الفرق. الأهمية العامة لا تفسّر تنبؤًا فرديًا.")}</section></div>
 <section class="panel priority-panel">${panelHead(T("High-risk priority queue", "قائمة مراجعة البلاغات عالية المخاطر"), T("Active reports only · Select a row for context", "البلاغات النشطة فقط · اختر صفًا لعرض التفاصيل"), `<label class="search-field">${icon("search")}<input id="queue-search" type="search" placeholder="${T("Search ID or district", "ابحث بالرقم أو الحي")}" value="${esc(state.search)}" aria-label="${T("Search priority queue", "البحث في قائمة المراجعة")}"></label>`)}<div id="queue-content">${queue()}</div></section><div class="context-notice">${icon("shield")}<p>${T("Human review required. All-row scores include training records. Model recall is 85.3%, precision 33.6% and ROC-AUC 68.7% on the retrospective test set.", "المراجعة البشرية مطلوبة. تتضمن درجات جميع السجلات بيانات تدريب. الاستدعاء 85.3%، والقيمة التنبؤية الإيجابية 33.6%، وROC-AUC ‏68.7% على مجموعة الاختبار الاستعادية.")}</p></div>`;
}
function queue() {
  let list = priorityQueue(data, state.filters);
  const search = state.search.trim().toLowerCase();
  if (search)
    list = list.filter((r) =>
      [r.id, district(r.district).en, district(r.district).ar].some((v) =>
        v.toLowerCase().includes(search),
      ),
    );
  const pages = Math.max(1, Math.ceil(list.length / 8));
  state.queuePage = Math.min(state.queuePage, pages - 1);
  const visible = list.slice(state.queuePage * 8, state.queuePage * 8 + 8);
  return `${visible.length ? `<div class="table-wrap"><table class="queue-table"><thead><tr><th>${T("Incident", "البلاغ")}</th><th>${T("District", "الحي")}</th><th>${T("Service", "الخدمة")}</th><th>${T("Risk score", "درجة المخاطر")}</th><th>${T("Status", "الحالة")}</th><th>${T("Shift", "الوردية")}</th><th><span class="sr-only">${T("Details", "التفاصيل")}</span></th></tr></thead><tbody>${visible.map((r) => `<tr><td><button class="incident-link" data-incident="${r.id}">${r.id}</button></td><td>${name(district(r.district))}</td><td class="service-cell">${name(category(r.category))}</td><td><span class="risk-value">${pct(r.risk)}</span><span class="risk-mini"><i style="width:${r.risk * 100}%"></i></span></td><td>${pill(word(r.status), "status-pill")}</td><td>${word(r.shift)}</td><td><button class="icon-btn" data-incident="${r.id}" aria-label="${T("Details for ", "تفاصيل ") + r.id}">${icon("arrow")}</button></td></tr>`).join("")}</tbody></table></div>` : empty()}<div class="pagination"><span>${list.length ? n(state.queuePage * 8 + 1) + "–" + n(Math.min((state.queuePage + 1) * 8, list.length)) : "0"} ${T("of", "من")} ${n(list.length)} ${T("reports", "بلاغ")}</span><div><button class="icon-btn previous" data-action="previous" ${state.queuePage === 0 ? "disabled" : ""} aria-label="${T("Previous page", "الصفحة السابقة")}">${icon("chevron")}</button><span>${n(state.queuePage + 1)} / ${n(pages)}</span><button class="icon-btn" data-action="next" ${state.queuePage >= pages - 1 ? "disabled" : ""} aria-label="${T("Next page", "الصفحة التالية")}">${icon("chevron")}</button></div></div>`;
}
function project() {
  const steps = [
    [
      "01",
      T("Prepare", "التجهيز"),
      T(
        "30,000 synthetic reports with validated keys, timestamps and outcomes.",
        "30,000 بلاغ اصطناعي مع التحقق من المفاتيح والطوابع الزمنية والنتائج.",
      ),
    ],
    [
      "02",
      T("Model", "النمذجة"),
      T(
        "Power Query, dimensional relationships and documented DAX definitions.",
        "Power Query وعلاقات الأبعاد وتعريفات موثقة لمقاييس DAX.",
      ),
    ],
    [
      "03",
      T("Evaluate", "التقييم"),
      T(
        "Time-based cohorts with labels available before each decision cutoff.",
        "مجموعات زمنية بنتائج متاحة قبل كل موعد فاصل لاتخاذ القرار.",
      ),
    ],
    [
      "04",
      T("Review", "المراجعة"),
      T(
        "Explain the metrics and prioritize active reports for human review.",
        "شرح المقاييس وترتيب البلاغات النشطة لدعم المراجعة البشرية.",
      ),
    ],
  ];
  return `<section class="project-hero panel"><div><span class="eyebrow gold">${T("A CITY. A QUESTION. A PORTFOLIO.", "مدينة. سؤال. مشروع.")}</span><h2>${T("From municipal reports<br>to informed decisions.", "من البلاغات البلدية<br>إلى قرارات مدروسة.")}</h2><p>${T("An independent portfolio inspired by internship experience at the Municipal Operations Monitoring Center in Madinah. It explores how demand, service levels and risk signals can be brought together for review.", "مشروع بورتفوليو مستقل مستوحى من تجربة تدريب في مركز مراقبة العمليات البلدية بالمدينة المنورة. يستكشف الجمع بين الطلب ومستويات الخدمة وإشارات المخاطر لدعم المراجعة.")}</p><div class="tag-list">${["Power BI", "Power Query", "DAX", "Python", "JavaScript"].map((s) => pill(s)).join("")}</div></div><div class="hero-facts"><div><strong>30,000</strong><span>${T("synthetic reports", "بلاغ اصطناعي")}</span></div><div><strong>12</strong><span>${T("districts", "حيًا")}</span></div><div><strong>4</strong><span>${T("connected perspectives", "زوايا تحليل مترابطة")}</span></div></div></section>
 <div class="method-steps">${steps.map(([i, title, body]) => `<article class="panel method-step"><span>${i}</span><h2>${title}</h2><p>${body}</p></article>`).join("")}</div>
 <div class="project-columns"><section class="panel">${panelHead(T("What the numbers mean", "ماذا تعني الأرقام؟"), T("Transparent definitions, useful boundaries", "تعريفات واضحة وحدود معلنة"))}<div class="definition-list">${[
   [
     "Active reports",
     "البلاغات النشطة",
     T(
       "Open + In Progress; 267 in the complete snapshot.",
       "المفتوح + قيد التنفيذ؛ 267 في البيانات الكاملة.",
     ),
   ],
   [
     "Nominal capacity",
     "السعة الاسمية",
     T(
       "356,984 synthetic capacity units. No assumed 12% allocation.",
       "356,984 وحدة سعة اصطناعية، دون افتراض تخصيص 12%.",
     ),
   ],
   [
     "Assignment delay",
     "تأخير الإسناد",
     T(
       "AssignedAt − CreatedAt; mean 0.307 hours. Not first-response time.",
       "وقت الإسناد ناقص وقت الإنشاء؛ المتوسط 0.307 ساعة. ليس زمن الاستجابة الأولى.",
     ),
   ],
   [
     "Model score",
     "درجة النموذج",
     T(
       "All 30,000 records are scored, including training records.",
       "تم تقييم السجلات الـ30,000، بما فيها بيانات التدريب.",
     ),
   ],
 ]
   .map(([en, ar, body]) => `<div><h3>${T(en, ar)}</h3><p>${body}</p></div>`)
   .join("")}</div></section>
 <section class="panel model-card">${panelHead(T("Model performance", "أداء النموذج"), T("AdaBoost Decision Stumps · 6,057 test records", "AdaBoost Decision Stumps · 6,057 سجل اختبار"))}<div class="performance-grid">${[
   [pct(data.metrics.test.recall), T("Recall", "الاستدعاء")],
   [
     pct(data.metrics.test.precision),
     T("Precision", "القيمة التنبؤية الإيجابية"),
   ],
   [pct(data.metrics.test.roc_auc), T("ROC-AUC", "ROC-AUC")],
   [pct(data.metrics.threshold, 0), T("Review threshold", "عتبة المراجعة")],
 ]
   .map(([v, l]) => `<div><strong>${v}</strong><span>${l}</span></div>`)
   .join(
     "",
   )}</div><p>${T("The higher recall comes with more false alerts. These metrics are not interchangeable, and recall is not accuracy.", "يأتي ارتفاع الاستدعاء مع مزيد من الإنذارات الكاذبة. هذه المقاييس ليست بدائل لبعضها، والاستدعاء ليس الدقة الكلية.")}</p><div class="cohort-strip"><span>${n(data.metrics.cohorts.training)} ${T("train", "تدريب")}</span><span>${n(data.metrics.cohorts.validation)} ${T("validation", "تحقق")}</span><span>${n(data.metrics.cohorts.testing)} ${T("test", "اختبار")}</span></div></section></div>
 <section class="panel boundaries">${panelHead(T("Built with context, not claims of deployment", "تحليل بسياق واضح، دون ادعاء تشغيل فعلي"), T("What this portfolio can and cannot establish", "ما يمكن لهذا المشروع إثباته وما لا يمكنه إثباته"))}<div class="boundary-grid"><div>${icon("shield")}<h3>${T("Synthetic, independent", "اصطناعي ومستقل")}</h3><p>${T("Not an official Municipality product. No operational improvement or real-world accuracy is claimed. The original data generator is unavailable.", "ليس منتجًا رسميًا للأمانة. لا ندّعي تحسنًا تشغيليًا أو دقة ميدانية. مولّد البيانات الأصلي غير متاح.")}</p></div><div>${icon("clock")}<h3>${T("Retrospective evaluation", "تقييم استعادي")}</h3><p>${T("Outcomes must be known before each cutoff. Unresolved cases are censored, and historical test outcomes have already been inspected.", "يجب معرفة النتائج قبل كل حد زمني. الحالات غير المحلولة غير مكتملة النتائج، وسبق الاطلاع على نتائج الاختبار التاريخية.")}</p></div><div>${icon("users")}<h3>${T("Human review first", "المراجعة البشرية أولًا")}</h3><p>${T("Staffing inputs are excluded from the model. Capacity and risk scores require contextual interpretation, not automatic staffing decisions.", "استُبعدت بيانات تخصيص الفرق من النموذج. السعة ودرجات المخاطر تحتاج إلى تفسير سياقي، ولا تتخذ قرارات توظيف تلقائية.")}</p></div></div></section>
 <section class="panel resources">${panelHead(T("Explore the complete project", "استكشف المشروع كاملًا"), T("Dashboard, evidence and the story behind the work", "التقرير والأدلة وقصة العمل"))}<div class="resource-grid">${[
   [
     "./downloads/case-study.pdf",
     "book",
     T("Case study", "دراسة الحالة"),
     T("Six pages · PDF", "ست صفحات · PDF"),
   ],
   [
     "./downloads/dashboard.pdf",
     "grid",
     T("Dashboard report", "تقرير لوحة المعلومات"),
     T("Four pages · PDF", "أربع صفحات · PDF"),
   ],
   [
     "./downloads/madinah-operations.pbix",
     "download",
     T("Power BI file", "ملف Power BI"),
     T("Desktop report · PBIX", "تقرير Desktop · PBIX"),
   ],
   [
     "https://github.com/youmnaeidh/Madinah-Operations-Intelligence/tree/codex/web-portfolio-2026-10-28/web-portfolio",
     "link",
     T("Source repository", "مستودع المصدر"),
     T("GitHub · Web source code", "GitHub · أكواد الموقع"),
   ],
 ]
   .map(
     ([url, g, title, sub]) =>
       `<a class="resource" href="${url}" ${url.endsWith("pbix") ? "download" : 'target="_blank" rel="noopener noreferrer"'}>${icon(g)}<span><strong>${title}</strong><small>${sub}</small></span>${icon("arrow")}</a>`,
   )
   .join("")}</div></section>
 <div class="author-note"><span class="avatar large">YA</span><div><strong>Yomna Alhejaili</strong><p>${T("Data & Business Intelligence · Operations analytics", "البيانات وذكاء الأعمال · تحليل العمليات")}</p></div><a class="text-btn" href="https://www.linkedin.com/in/yomna-alhejaili-0b3991216" target="_blank" rel="noopener noreferrer">LinkedIn ${icon("link")}</a></div>`;
}

function render({ animate = true } = {}) {
  const focused = document.activeElement?.id,
    scroll = window.scrollY;
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.documentElement.dataset.motion = state.motion ? "on" : "off";
  rows = filtered(data, state.filters);
  stats = summarize(data, state.filters, rows);
  app.innerHTML = shell();
  viewCount++;
  if (!animate)
    document.querySelector("#page-content").classList.add("no-enter");
  if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  if (animate) animateNumbers();
  window.scrollTo({ top: scroll, behavior: "instant" });
}
function animateNumbers() {
  if (!state.motion || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  document.querySelectorAll("[data-value]").forEach((el) => {
    if (el.dataset.value === "") return;
    const target = Number(el.dataset.value),
      format = el.dataset.format,
      start = performance.now(),
      duration = 480;
    const tick = (now) => {
      if (!el.isConnected) return;
      const p = Math.min(1, (now - start) / duration),
        v = target * (1 - (1 - p) ** 4);
      el.textContent =
        format === "percent" ? pct(v) : n(v, format === "hours" ? 1 : 0);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 3000);
}
function navigate(page) {
  if (!titles[page]) return;
  state.page = page;
  state.menu = false;
  history.replaceState(null, "", "#" + page);
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelector("#main").focus({ preventScroll: true });
}
function setFilter(key, value) {
  state.filters[key] = value;
  state.queuePage = 0;
  render();
}
function closeDialog() {
  document.querySelector("#overlay-root").innerHTML = "";
  document.body.classList.remove("dialog-open");
  lastFocus?.focus({ preventScroll: true });
}
function openDialog(body, drawer = false) {
  lastFocus = document.activeElement;
  const root = document.querySelector("#overlay-root");
  root.innerHTML = `<div class="modal-backdrop"><section class="${drawer ? "drawer" : "dialog"}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="icon-btn close-dialog" data-action="close-dialog" aria-label="${T("Close", "إغلاق")}">${icon("close")}</button>${body}</section></div>`;
  document.body.classList.add("dialog-open");
  root.querySelector(".close-dialog").focus();
}
function detail(id) {
  const r = data.rows.find((r) => r.id === id);
  if (!r) return;
  const fields = [
    [T("District", "الحي"), name(district(r.district))],
    [T("Service category", "فئة الخدمة"), name(category(r.category))],
    [T("Source subcategory", "الفئة الفرعية في المصدر"), r.subcategory],
    [T("Status", "الحالة"), word(r.status)],
    [T("Source priority", "الأولوية في المصدر"), word(r.priority)],
    [T("Shift", "الوردية"), word(r.shift)],
    [
      T("Repeat report", "بلاغ متكرر"),
      r.repeat ? T("Yes", "نعم") : T("No", "لا"),
    ],
    [T("Evaluation cohort", "مجموعة التقييم"), word(r.split)],
  ];
  openDialog(
    `<div class="eyebrow gold">${T("INCIDENT CONTEXT", "سياق البلاغ")}</div><h2 id="dialog-title">${r.id}</h2><p class="muted">${T("Synthetic record · For review, not automatic action", "سجل اصطناعي · للمراجعة، وليس لاتخاذ إجراء تلقائي")}</p><div class="detail-risk"><span>${T("Predicted breach probability", "الاحتمال المتوقع لتجاوز المهلة")}</span><strong>${pct(r.risk)}</strong>${pill(T("High risk ≥40%", "مخاطر عالية ≥40%"), "risk-pill")}</div><dl class="detail-fields">${fields.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><h3>${T("Recorded timeline", "التسلسل الزمني المسجل")}</h3><div class="timeline">${[
      [T("Created", "الإنشاء"), r.created],
      [T("Assigned", "الإسناد"), r.assigned],
      [
        T("Resolved", "الحل"),
        r.resolved || T("Awaiting resolution", "بانتظار الحل"),
      ],
    ]
      .map(
        ([k, v]) =>
          `<div><i></i><span>${k}</span><strong dir="ltr">${esc(v)}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="context-notice"><p>${T("The score is not a causal explanation. Source priority and model risk are different concepts. Review the original context before action.", "الدرجة ليست تفسيرًا سببيًا. الأولوية في المصدر ومخاطر النموذج مفهومان مختلفان. راجع السياق الأصلي قبل اتخاذ أي إجراء.")}</p></div>`,
    true,
  );
}
document.addEventListener("click", (event) => {
  if (state.menu && !event.target.closest(".sidebar,.mobile-menu")) {
    state.menu = false;
    render({ animate: false });
    return;
  }
  const button = event.target.closest("button,a.brand,.hour-point");
  if (!button) {
    if (event.target.classList.contains("modal-backdrop")) closeDialog();
    return;
  }
  if (button.matches("a.brand")) {
    event.preventDefault();
    navigate("overview");
    return;
  }
  if (button.dataset.page) {
    navigate(button.dataset.page);
    return;
  }
  for (const key of ["district", "category", "shift", "hour"])
    if (button.dataset[key] != null) {
      setFilter(
        key,
        String(state.filters[key]) === button.dataset[key]
          ? ""
          : button.dataset[key],
      );
      return;
    }
  if (button.dataset.map) {
    state.mapMode = button.dataset.map;
    render({ animate: false });
    return;
  }
  if (button.dataset.info) {
    openDialog(
      `<div class="eyebrow gold">${T("METRIC DEFINITION", "تعريف المؤشر")}</div><h2 id="dialog-title">${T("Know what you are measuring", "اعرف ما تقيسه")}</h2><p>${T(...metricDefinitions[button.dataset.info])}</p><p class="muted">${T("Definitions follow the verified Power BI model.", "التعريفات تتبع نموذج Power BI المتحقق منه.")}</p>`,
    );
    return;
  }
  if (button.dataset.incident) {
    detail(button.dataset.incident);
    return;
  }
  switch (button.dataset.action) {
    case "language":
      state.lang = state.lang === "en" ? "ar" : "en";
      store.set("moi-lang", state.lang);
      render();
      break;
    case "motion":
      state.motion = !state.motion;
      store.set("moi-motion", state.motion ? "on" : "off");
      render({ animate: false });
      toast(
        state.motion
          ? T("Motion enabled", "تم تفعيل الحركة")
          : T("Reduced motion enabled", "تم تقليل الحركة"),
      );
      break;
    case "menu":
      state.menu = !state.menu;
      render({ animate: false });
      break;
    case "reset":
      state.filters = {
        start: "2025-10-05",
        end: "2026-04-05",
        district: "",
        category: "",
        shift: "",
        hour: "",
      };
      state.queuePage = 0;
      state.search = "";
      render();
      toast(T("All filters reset", "تمت إعادة ضبط جميع الفلاتر"));
      break;
    case "clear-hour":
      setFilter("hour", "");
      break;
    case "close-dialog":
      closeDialog();
      break;
    case "previous":
      state.queuePage = Math.max(0, state.queuePage - 1);
      document.querySelector("#queue-content").innerHTML = queue();
      break;
    case "next":
      state.queuePage++;
      document.querySelector("#queue-content").innerHTML = queue();
      break;
  }
});
document.addEventListener("change", (event) => {
  const key = event.target.dataset.filter;
  if (!key) return;
  const value = event.target.value;
  if (key === "start" || key === "end") {
    if (
      !value ||
      value < "2025-10-05" ||
      value > "2026-04-05" ||
      (key === "start" && value > state.filters.end) ||
      (key === "end" && value < state.filters.start)
    ) {
      event.target.value = state.filters[key];
      toast(
        T(
          "Choose a valid range between 5 Oct 2025 and 5 Apr 2026.",
          "اختر فترة صحيحة بين 5 أكتوبر 2025 و5 أبريل 2026.",
        ),
      );
      return;
    }
  }
  setFilter(key, value);
});
document.addEventListener("input", (event) => {
  if (event.target.id === "queue-search") {
    state.search = event.target.value;
    state.queuePage = 0;
    document.querySelector("#queue-content").innerHTML = queue();
  }
});
document.addEventListener("keydown", (event) => {
  const dialog = document.querySelector('[role="dialog"]');
  if (event.key === "Escape") {
    if (dialog) closeDialog();
    else if (state.menu) {
      state.menu = false;
      render({ animate: false });
    }
    return;
  }
  if (dialog && event.key === "Tab") {
    const nodes = [
      ...dialog.querySelectorAll('button,a,input,select,[tabindex="0"]'),
    ].filter((x) => !x.disabled);
    if (event.shiftKey && document.activeElement === nodes[0]) {
      event.preventDefault();
      nodes.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
      event.preventDefault();
      nodes[0].focus();
    }
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.classList.contains("hour-point")
  ) {
    event.preventDefault();
    setFilter("hour", event.target.dataset.hour);
  }
});
window.addEventListener("hashchange", () => {
  const page = location.hash.slice(1);
  if (titles[page]) navigate(page);
});
try {
  const response = await fetch("./assets/data.json");
  if (!response.ok) throw Error("Data request failed");
  data = hydrate(await response.json());
  const page = location.hash.slice(1);
  if (titles[page]) state.page = page;
  render();
} catch (error) {
  console.error(error);
  app.innerHTML = `<div class="boot"><h1>${T("The data could not be loaded", "تعذّر تحميل البيانات")}</h1><p>${T("Open the project through its local preview server, then reload.", "افتح المشروع عبر خادم المعاينة المحلي، ثم أعد تحميل الصفحة.")}</p><button class="button" onclick="location.reload()">${T("Retry", "إعادة المحاولة")}</button></div>`;
}
