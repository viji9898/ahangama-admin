import { runGaReport } from "./ga4QrAnalytics.mjs";

export const FREE_PASS_PROMO_TARGETS = [
  {
    key: "lighthouse__ps",
    venue: "lighthouse",
    venueLabel: "Lighthouse",
    surface: "ps",
    utmContent: "lighthouse__ps",
    targetPath: "/lighthouse/?promo=free_pass",
    pathAliases: ["/lighthouse/?promo=free_pass", "/lighthouse?promo=free_pass"],
    targetUrl:
      "https://ahangama.com/lighthouse/?utm_source=qr&utm_medium=offline&utm_campaign=qr_promo_2026&utm_content=lighthouse__ps&utm_term=h&promo=free_pass",
  },
  {
    key: "kaffi__ps",
    venue: "kaffi",
    venueLabel: "Kaffi",
    surface: "ps",
    utmContent: "kaffi__ps",
    targetPath: "/kaffi/?promo=free_pass",
    pathAliases: ["/kaffi/?promo=free_pass", "/kaffi?promo=free_pass"],
    targetUrl:
      "https://ahangama.com/kaffi/?utm_source=qr&utm_medium=offline&utm_campaign=qr_promo_2026&utm_content=kaffi__ps&utm_term=h&promo=free_pass",
  },
  {
    key: "gusta__ps",
    venue: "gusta",
    venueLabel: "Gusta",
    surface: "ps",
    utmContent: "gusta__ps",
    targetPath: "/gusta/?promo=free_pass",
    pathAliases: ["/gusta/?promo=free_pass", "/gusta?promo=free_pass"],
    targetUrl:
      "https://ahangama.com/gusta/?utm_source=qr&utm_medium=offline&utm_campaign=qr_promo_2026&utm_content=gusta__ps&utm_term=h&promo=free_pass",
  },
  {
    key: "tahini__ps",
    venue: "tahini",
    venueLabel: "Tahini",
    surface: "ps",
    utmContent: "tahini__ps",
    targetPath: "/tahini/?promo=free_pass",
    pathAliases: ["/tahini/?promo=free_pass", "/tahini?promo=free_pass"],
    targetUrl:
      "https://ahangama.com/tahini/?utm_source=qr&utm_medium=offline&utm_campaign=qr_promo_2026&utm_content=tahini__ps&utm_term=h&promo=free_pass",
  },
  {
    key: "living-room__ps",
    venue: "living-room",
    venueLabel: "Living Room",
    surface: "ps",
    utmContent: "living-room__ps",
    targetPath: "/living-room/?promo=free_pass",
    pathAliases: ["/living-room/?promo=free_pass", "/living-room?promo=free_pass"],
    targetUrl:
      "https://ahangama.com/living-room/?utm_source=qr&utm_medium=offline&utm_campaign=qr_promo_2026&utm_content=living-room__ps&utm_term=h&promo=free_pass",
  },
];

function parseUtmContent(value = "") {
  const parts = String(value || "")
    .split("__")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    venue: parts[0] || "unknown",
    surface: parts[1] || "unknown",
    creative: parts.slice(2).join("__") || "",
  };
}

function formatLabel(value = "") {
  const normalized = String(value || "unknown")
    .trim()
    .replace(/[-_]+/g, " ");

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createRow(utmContent) {
  const parsed = parseUtmContent(utmContent);
  const target = FREE_PASS_PROMO_TARGETS.find(
    (item) => item.utmContent === utmContent,
  );

  return {
    key: target?.key || utmContent || "unknown",
    venue: target?.venue || parsed.venue,
    venueLabel: target?.venueLabel || formatLabel(parsed.venue),
    surface: target?.surface || parsed.surface,
    creative: parsed.creative,
    utmContent: target?.utmContent || utmContent || "(not set)",
    targetPath: target?.targetPath || "",
    targetUrl: target?.targetUrl || "",
    pageViews: 0,
    sessions: 0,
    users: 0,
    freePassPageViews: 0,
    freePassSessions: 0,
    freePassUsers: 0,
    freePassLandingPages: [],
    landingPages: [],
  };
}

function baseQrExpressions() {
  return [
    {
      filter: {
        fieldName: "sessionManualSource",
        stringFilter: {
          matchType: "EXACT",
          value: "qr",
        },
      },
    },
    {
      filter: {
        fieldName: "sessionManualMedium",
        stringFilter: {
          matchType: "EXACT",
          value: "offline",
        },
      },
    },
  ];
}

function utmContentExpression(utmContents) {
  return {
    orGroup: {
      expressions: utmContents.map((utmContent) => ({
        filter: {
          fieldName: "sessionManualAdContent",
          stringFilter: {
            matchType: "EXACT",
            value: utmContent,
          },
        },
      })),
    },
  };
}

function pathExpression(paths) {
  return {
    orGroup: {
      expressions: paths.map((path) => ({
        filter: {
          fieldName: "pagePathPlusQueryString",
          stringFilter: {
            matchType: "EXACT",
            value: path,
          },
        },
      })),
    },
  };
}

async function runSessionLandingReport({
  startDate,
  endDate,
  expressions,
  pageDimension = "landingPagePlusQueryString",
}) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionManualAdContent" },
      { name: "sessionManualTerm" },
      { name: pageDimension },
    ],
    metrics: [
      { name: "screenPageViews" },
      { name: "sessions" },
      { name: "activeUsers" },
    ],
    dimensionFilter: {
      andGroup: {
        expressions,
      },
    },
    keepEmptyRows: false,
    limit: 10000,
    orderBys: [
      {
        metric: {
          metricName: "screenPageViews",
        },
        desc: true,
      },
    ],
  });
}

function addReportRows(groupedRows, report, mode) {
  for (const row of report?.rows || []) {
    const utmContent = row.dimensionValues?.[0]?.value || "";
    const utmTerm = row.dimensionValues?.[1]?.value || "";
    const landingPage = row.dimensionValues?.[2]?.value || "";
    const pageViews = Number(row.metricValues?.[0]?.value || 0);
    const sessions = Number(row.metricValues?.[1]?.value || 0);
    const users = Number(row.metricValues?.[2]?.value || 0);
    const key = utmContent || "unknown";
    const existing = groupedRows.get(key) || createRow(utmContent);

    if (mode === "freePass") {
      const targetPaths = new Set(
        (FREE_PASS_PROMO_TARGETS.find(
          (target) => target.utmContent === utmContent,
        )?.pathAliases || [])
          .map((path) => path.toLowerCase()),
      );

      if (!targetPaths.has(String(landingPage).toLowerCase())) {
        continue;
      }

      existing.freePassPageViews += pageViews;
      existing.freePassSessions += sessions;
      existing.freePassUsers += users;
      existing.freePassLandingPages.push({
        landingPage,
        utmTerm,
        pageViews,
        sessions,
        users,
      });
    } else {
      existing.pageViews += pageViews;
      existing.sessions += sessions;
      existing.users += users;
      existing.landingPages.push({
        landingPage,
        utmTerm,
        pageViews,
        sessions,
        users,
      });
    }

    groupedRows.set(key, existing);
  }
}

export async function getFreePassPromoStats({ startDate, endDate }) {
  const groupedRows = new Map(
    FREE_PASS_PROMO_TARGETS.map((target) => [
      target.utmContent,
      createRow(target.utmContent),
    ]),
  );
  const targetUtmContents = FREE_PASS_PROMO_TARGETS.map(
    (target) => target.utmContent,
  );
  const targetPaths = FREE_PASS_PROMO_TARGETS.flatMap(
    (target) => target.pathAliases,
  );
  const attributedReport = await runSessionLandingReport({
    startDate,
    endDate,
    expressions: [
      ...baseQrExpressions(),
      utmContentExpression(targetUtmContents),
    ],
  });

  addReportRows(groupedRows, attributedReport, "attributed");

  const freePassReport = await runSessionLandingReport({
    startDate,
    endDate,
    pageDimension: "pagePathPlusQueryString",
    expressions: [
      ...baseQrExpressions(),
      utmContentExpression(targetUtmContents),
      pathExpression(targetPaths),
    ],
  });
  addReportRows(groupedRows, freePassReport, "freePass");

  const rows = FREE_PASS_PROMO_TARGETS.map((target) =>
    groupedRows.get(target.utmContent),
  )
    .filter(Boolean)
    .map((row) => ({
      ...row,
      freePassLandingPages: row.freePassLandingPages.sort(
        (left, right) =>
          right.pageViews - left.pageViews ||
          String(left.landingPage).localeCompare(String(right.landingPage)),
      ),
      landingPages: row.landingPages.sort(
        (left, right) =>
          right.pageViews - left.pageViews ||
          String(left.landingPage).localeCompare(String(right.landingPage)),
      ),
    }))
    .sort(
      (left, right) =>
        right.pageViews - left.pageViews ||
        right.freePassPageViews - left.freePassPageViews ||
        String(left.venueLabel).localeCompare(String(right.venueLabel)),
    );

  const totals = rows.reduce(
    (accumulator, row) => ({
      pageViews: accumulator.pageViews + row.pageViews,
      sessions: accumulator.sessions + row.sessions,
      users: accumulator.users + row.users,
      freePassPageViews: accumulator.freePassPageViews + row.freePassPageViews,
      freePassSessions: accumulator.freePassSessions + row.freePassSessions,
      freePassUsers: accumulator.freePassUsers + row.freePassUsers,
    }),
    {
      pageViews: 0,
      sessions: 0,
      users: 0,
      freePassPageViews: 0,
      freePassSessions: 0,
      freePassUsers: 0,
    },
  );

  return {
    startDate,
    endDate,
    totals,
    rows,
  };
}