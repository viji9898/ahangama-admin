import { requireAdmin } from "./_lib/auth.mjs";
import { runGaReport } from "./_lib/ga4QrAnalytics.mjs";

const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

function getDateRange(queryStringParameters = {}) {
  const startDate = String(
    queryStringParameters.startDate || DEFAULT_START_DATE,
  ).trim();
  const endDate = String(
    queryStringParameters.endDate || DEFAULT_END_DATE,
  ).trim();

  return {
    startDate: startDate || DEFAULT_START_DATE,
    endDate: endDate || DEFAULT_END_DATE,
  };
}

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

  return {
    key: utmContent || "unknown",
    venue: parsed.venue,
    venueLabel: formatLabel(parsed.venue),
    surface: parsed.surface,
    creative: parsed.creative,
    utmContent: utmContent || "(not set)",
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

async function runSessionLandingReport({ startDate, endDate, expressions }) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionManualAdContent" },
      { name: "sessionManualTerm" },
      { name: "landingPagePlusQueryString" },
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

async function getFreePassRows({ startDate, endDate }) {
  const groupedRows = new Map();
  const attributedReport = await runSessionLandingReport({
    startDate,
    endDate,
    expressions: [
      ...baseQrExpressions(),
      {
        filter: {
          fieldName: "sessionManualAdContent",
          stringFilter: {
            matchType: "CONTAINS",
            value: "__ps",
          },
        },
      },
    ],
  });

  addReportRows(groupedRows, attributedReport, "attributed");

  const freePassReport = await runSessionLandingReport({
    startDate,
    endDate,
    expressions: [
      ...baseQrExpressions(),
      {
        filter: {
          fieldName: "landingPagePlusQueryString",
          stringFilter: {
            matchType: "CONTAINS",
            value: "promo=free_pass",
          },
        },
      },
    ],
  });
  addReportRows(groupedRows, freePassReport, "freePass");

  return [...groupedRows.values()]
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
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const { startDate, endDate } = getDateRange(
      event.queryStringParameters || {},
    );
    const rows = await getFreePassRows({ startDate, endDate });
    const totals = rows.reduce(
      (accumulator, row) => ({
        pageViews: accumulator.pageViews + row.pageViews,
        sessions: accumulator.sessions + row.sessions,
        users: accumulator.users + row.users,
        freePassPageViews:
          accumulator.freePassPageViews + row.freePassPageViews,
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

    return json(200, {
      ok: true,
      startDate,
      endDate,
      totals,
      rows,
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
