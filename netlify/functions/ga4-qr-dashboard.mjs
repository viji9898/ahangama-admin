import { GoogleAuth } from "google-auth-library";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { requireAdmin } from "./_lib/auth.mjs";

const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API_BASE_URL = "https://analyticsdata.googleapis.com/v1beta";
const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";
const CTA_CLICK_EVENT_NAME_PATTERN = "(^|_)cta_click$";
const ROOT_HOSTNAME = "ahangama.com";
const PASS_HOSTNAME = "pass.ahangama.com";

loadEnv({ path: resolve(process.cwd(), ".env") });

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

function normalizePrivateKey(value = "") {
  return String(value).replace(/\\n/g, "\n").trim();
}

function parseUtmContent(value) {
  const parts = String(value || "")
    .split("__")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    venue: parts[0] || "unknown",
    surface: parts[1] || "unknown",
    creative: parts.slice(2).join("__") || "unknown",
  };
}

function normalizeLandingPage(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue, "https://ahangama.example");
    const keysToDelete = [];

    for (const key of url.searchParams.keys()) {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey.startsWith("utm_") ||
        normalizedKey === "fbclid" ||
        normalizedKey === "gclid" ||
        normalizedKey === "dclid" ||
        normalizedKey === "msclkid" ||
        normalizedKey === "ttclid" ||
        normalizedKey === "twclid" ||
        normalizedKey === "mc_cid" ||
        normalizedKey === "mc_eid"
      ) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      url.searchParams.delete(key);
    }

    const pathname = url.pathname || "/";
    const search = url.searchParams.toString();

    return search ? `${pathname}?${search}` : pathname;
  } catch {
    return rawValue.split("?")[0] || rawValue;
  }
}

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

function buildBaseExpressions(queryStringParameters = {}) {
  const expressions = [
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

  const venueFilter = buildVenueFilter(queryStringParameters);

  if (venueFilter) {
    expressions.push(venueFilter);
  }

  return expressions;
}

function buildDimensionFilter(queryStringParameters = {}) {
  return {
    andGroup: {
      expressions: buildBaseExpressions(queryStringParameters),
    },
  };
}

function buildVenueFilter(queryStringParameters = {}) {
  const venue = String(queryStringParameters.venue || "")
    .trim()
    .toLowerCase();

  if (!venue) {
    return null;
  }

  return {
    filter: {
      fieldName: "sessionManualAdContent",
      stringFilter: {
        matchType: "BEGINS_WITH",
        value: `${venue}__`,
      },
    },
  };
}

function buildEventNameFilter(
  { eventName, eventNamePattern },
  queryStringParameters = {},
) {
  const eventNameFilter = eventName
    ? {
        filter: {
          fieldName: "eventName",
          stringFilter: {
            matchType: "EXACT",
            value: eventName,
          },
        },
      }
    : eventNamePattern
      ? {
          filter: {
            fieldName: "eventName",
            stringFilter: {
              matchType: "PARTIAL_REGEXP",
              value: eventNamePattern,
            },
          },
        }
      : null;

  return {
    andGroup: {
      expressions: [
        ...buildBaseExpressions(queryStringParameters),
        ...(eventNameFilter ? [eventNameFilter] : []),
      ],
    },
  };
}

function buildRowKey(utmContent, landingPage) {
  return `${String(utmContent || "").trim()}::${String(landingPage || "").trim()}`;
}

async function runEventBreakdownReport({
  propertyId,
  startDate,
  endDate,
  venue,
  eventName,
  eventNamePattern,
}) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "sessionManualAdContent" },
          { name: "landingPagePlusQueryString" },
        ],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: buildEventNameFilter(
          { eventName, eventNamePattern },
          { venue },
        ),
        keepEmptyRows: false,
        limit: 1000,
        orderBys: [
          {
            metric: {
              metricName: "eventCount",
            },
            desc: true,
          },
        ],
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message || `GA4 request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function getAccessToken() {
  const clientEmail = String(process.env.GOOGLE_CLIENT_EMAIL || "").trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google service account credentials");
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [ANALYTICS_SCOPE],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

  if (!token) {
    throw new Error("Unable to acquire Google access token");
  }

  return token;
}

async function runReport({ propertyId, startDate, endDate, venue }) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "sessionManualAdContent" },
          { name: "landingPagePlusQueryString" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "eventCount" },
        ],
        dimensionFilter: buildDimensionFilter({ venue }),
        keepEmptyRows: false,
        limit: 1000,
        orderBys: [
          {
            metric: {
              metricName: "sessions",
            },
            desc: true,
          },
        ],
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message || `GA4 request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function runEventCountReport({
  propertyId,
  startDate,
  endDate,
  venue,
  eventName,
  eventNamePattern,
}) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: buildEventNameFilter(
          { eventName, eventNamePattern },
          { venue },
        ),
        keepEmptyRows: false,
        limit: 1,
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message || `GA4 request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function runHostTrafficReport({
  propertyId,
  startDate,
  endDate,
  hostName,
}) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "hostName" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "screenPageViews" },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              ...buildBaseExpressions(),
              {
                filter: {
                  fieldName: "hostName",
                  stringFilter: {
                    matchType: "EXACT",
                    value: hostName,
                  },
                },
              },
            ],
          },
        },
        keepEmptyRows: false,
        limit: 1,
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message || `GA4 request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function mapEventCountRows(rows = []) {
  const eventCounts = new Map();

  for (const row of rows) {
    const dimensionValues = row.dimensionValues || [];
    const utmContent = dimensionValues[0]?.value || "";
    const landingPage = normalizeLandingPage(dimensionValues[1]?.value || "");
    const key = buildRowKey(utmContent, landingPage);

    eventCounts.set(
      key,
      Number(eventCounts.get(key) || 0) +
        Number(row.metricValues?.[0]?.value || 0),
    );
  }

  return eventCounts;
}

function mapRows(rows = [], ctaClicksByRow = new Map()) {
  const groupedRows = new Map();

  for (const row of rows) {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    const utmContent = dimensionValues[0]?.value || "";
    const landingPage = normalizeLandingPage(dimensionValues[1]?.value || "");
    const key = buildRowKey(utmContent, landingPage);
    const existing = groupedRows.get(key);

    if (existing) {
      existing.sessions += Number(metricValues[0]?.value || 0);
      existing.users += Number(metricValues[1]?.value || 0);
      existing.events += Number(metricValues[2]?.value || 0);
      continue;
    }

    const parsed = parseUtmContent(utmContent);

    groupedRows.set(key, {
      venue: parsed.venue,
      surface: parsed.surface,
      creative: parsed.creative,
      sessions: Number(metricValues[0]?.value || 0),
      users: Number(metricValues[1]?.value || 0),
      events: Number(metricValues[2]?.value || 0),
      ctaClick: Number(ctaClicksByRow.get(key) || 0),
      landingPage,
    });
  }

  return [...groupedRows.values()];
}

function getEventCountFromReport(report) {
  return Number(report?.rows?.[0]?.metricValues?.[0]?.value || 0);
}

function mapHostTrafficReport(report, hostName) {
  const row = report?.rows?.[0];

  return {
    key: hostName,
    hostName,
    source: "qr",
    medium: "offline",
    sessions: Number(row?.metricValues?.[0]?.value || 0),
    users: Number(row?.metricValues?.[1]?.value || 0),
    pageViews: Number(row?.metricValues?.[2]?.value || 0),
  };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const propertyId = String(process.env.GA4_PROPERTY_ID || "").trim();
    if (!propertyId) {
      throw new Error("Missing env var: GA4_PROPERTY_ID");
    }

    const queryStringParameters = event.queryStringParameters || {};
    const { startDate, endDate } = getDateRange(queryStringParameters);
    const venue = String(queryStringParameters.venue || "")
      .trim()
      .toLowerCase();

    const [
      report,
      ctaClickReport,
      ctaClickBreakdownReport,
      rootTrafficReport,
      passTrafficReport,
    ] = await Promise.all([
      runReport({
        propertyId,
        startDate,
        endDate,
        venue,
      }),
      runEventCountReport({
        propertyId,
        startDate,
        endDate,
        venue,
        eventNamePattern: CTA_CLICK_EVENT_NAME_PATTERN,
      }),
      runEventBreakdownReport({
        propertyId,
        startDate,
        endDate,
        venue,
        eventNamePattern: CTA_CLICK_EVENT_NAME_PATTERN,
      }),
      runHostTrafficReport({
        propertyId,
        startDate,
        endDate,
        hostName: ROOT_HOSTNAME,
      }),
      runHostTrafficReport({
        propertyId,
        startDate,
        endDate,
        hostName: PASS_HOSTNAME,
      }),
    ]);

    const ctaClicksByRow = mapEventCountRows(ctaClickBreakdownReport.rows);

    return json(200, {
      rows: mapRows(report.rows, ctaClicksByRow),
      rootTrafficRows: [mapHostTrafficReport(rootTrafficReport, ROOT_HOSTNAME)],
      passTrafficRows: [mapHostTrafficReport(passTrafficReport, PASS_HOSTNAME)],
      stats: {
        ctaClick: getEventCountFromReport(ctaClickReport),
      },
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
