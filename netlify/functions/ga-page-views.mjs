import { requireAdmin } from "./_lib/auth.mjs";
import { runGaReport } from "./_lib/ga4QrAnalytics.mjs";

const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";
const TARGET_HOST = "ahangama.com";

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

function hostFilter() {
  return {
    filter: {
      fieldName: "hostName",
      stringFilter: {
        matchType: "EXACT",
        value: TARGET_HOST,
      },
    },
  };
}

function pathPrefixFilter(pathPrefix) {
  return {
    filter: {
      fieldName: "pagePath",
      stringFilter: {
        matchType: "BEGINS_WITH",
        value: pathPrefix,
      },
    },
  };
}

async function runMetricReport({ startDate, endDate, pathPrefix = "" }) {
  const expressions = [hostFilter()];

  if (pathPrefix) {
    expressions.push(pathPrefixFilter(pathPrefix));
  }

  const report = await runGaReport({
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "screenPageViews" },
      { name: "activeUsers" },
      { name: "sessions" },
    ],
    dimensionFilter: {
      andGroup: {
        expressions,
      },
    },
    keepEmptyRows: true,
    limit: 1,
  });

  const row = report?.rows?.[0];

  return {
    pageViews: Number(row?.metricValues?.[0]?.value || 0),
    users: Number(row?.metricValues?.[1]?.value || 0),
    sessions: Number(row?.metricValues?.[2]?.value || 0),
  };
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

    const [siteTotals, guideTotals, eventsTotals] = await Promise.all([
      runMetricReport({ startDate, endDate }),
      runMetricReport({ startDate, endDate, pathPrefix: "/guide" }),
      runMetricReport({ startDate, endDate, pathPrefix: "/events" }),
    ]);

    return json(200, {
      ok: true,
      hostName: TARGET_HOST,
      startDate,
      endDate,
      rows: [
        {
          key: "site",
          label: "ahangama.com",
          scope: "Host",
          path: "All pages",
          ...siteTotals,
        },
        {
          key: "guide",
          label: "/guide",
          scope: "Path prefix",
          path: "/guide*",
          ...guideTotals,
        },
        {
          key: "events",
          label: "/events",
          scope: "Path prefix",
          path: "/events*",
          ...eventsTotals,
        },
      ],
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
