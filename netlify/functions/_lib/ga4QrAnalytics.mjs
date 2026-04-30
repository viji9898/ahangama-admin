import { GoogleAuth } from "google-auth-library";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API_BASE_URL = "https://analyticsdata.googleapis.com/v1beta";
const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";
const CTA_CLICK_EVENT_NAME_PATTERN = "(^|_)cta_click$";
const PURCHASE_EVENT_NAME = "purchase";
const PURCHASE_LOOKBACK_DAYS = 7;
const ROOT_HOSTNAME = "ahangama.com";
const PASS_HOSTNAME = "pass.ahangama.com";

loadEnv({ path: resolve(process.cwd(), ".env") });

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

function buildVenueFilter(venue = "") {
  const normalizedVenue = String(venue || "")
    .trim()
    .toLowerCase();

  if (!normalizedVenue) {
    return null;
  }

  return {
    filter: {
      fieldName: "sessionManualAdContent",
      stringFilter: {
        matchType: "BEGINS_WITH",
        value: `${normalizedVenue}__`,
      },
    },
  };
}

function buildBaseExpressions(venue = "") {
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

  const venueFilter = buildVenueFilter(venue);

  if (venueFilter) {
    expressions.push(venueFilter);
  }

  return expressions;
}

function buildDimensionFilter(venue = "") {
  return {
    andGroup: {
      expressions: buildBaseExpressions(venue),
    },
  };
}

function buildPurchaseDimensionFilter(venue = "") {
  const expressions = [
    {
      filter: {
        fieldName: "eventName",
        stringFilter: {
          matchType: "EXACT",
          value: PURCHASE_EVENT_NAME,
        },
      },
    },
  ];

  const normalizedVenue = String(venue || "")
    .trim()
    .toLowerCase();

  if (normalizedVenue) {
    expressions.push({
      filter: {
        fieldName: "customEvent:qr_content",
        stringFilter: {
          matchType: "BEGINS_WITH",
          value: `${normalizedVenue}__`,
        },
      },
    });
  }

  return {
    andGroup: {
      expressions,
    },
  };
}

function buildEventNameFilter({ eventName, eventNamePattern }, venue = "") {
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
        ...buildBaseExpressions(venue),
        ...(eventNameFilter ? [eventNameFilter] : []),
      ],
    },
  };
}

function buildRowKey(utmContent, landingPage) {
  return `${String(utmContent || "").trim()}::${String(landingPage || "").trim()}`;
}

function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function toIsoDateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getPurchaseQueryStartDate(startDate, endDate) {
  if (!isIsoDateString(startDate) || !isIsoDateString(endDate)) {
    return startDate;
  }

  const todayIso = toIsoDateString(Date.now());

  if (startDate !== todayIso || endDate !== todayIso) {
    return startDate;
  }

  const lookbackDate = new Date(`${todayIso}T00:00:00Z`);
  lookbackDate.setUTCDate(lookbackDate.getUTCDate() - PURCHASE_LOOKBACK_DAYS);

  return toIsoDateString(lookbackDate);
}

function isDateWithinRange(dateValue, startDate, endDate) {
  if (!isIsoDateString(dateValue)) {
    return true;
  }

  if (!isIsoDateString(startDate) || !isIsoDateString(endDate)) {
    return true;
  }

  return dateValue >= startDate && dateValue <= endDate;
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

async function runGaReport(body) {
  const propertyId = String(process.env.GA4_PROPERTY_ID || "").trim();

  if (!propertyId) {
    throw new Error("Missing env var: GA4_PROPERTY_ID");
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

async function runReport({ startDate, endDate, venue }) {
  return runGaReport({
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
    dimensionFilter: buildDimensionFilter(venue),
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
  });
}

async function runEventCountReport({
  startDate,
  endDate,
  venue,
  eventName,
  eventNamePattern,
}) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: buildEventNameFilter(
      { eventName, eventNamePattern },
      venue,
    ),
    keepEmptyRows: false,
    limit: 1,
  });
}

async function runEventBreakdownReport({
  startDate,
  endDate,
  venue,
  eventName,
  eventNamePattern,
}) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionManualAdContent" },
      { name: "landingPagePlusQueryString" },
    ],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: buildEventNameFilter(
      { eventName, eventNamePattern },
      venue,
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
  });
}

async function runPurchaseBreakdownReport({ startDate, endDate, venue }) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "date" },
      { name: "customEvent:qr_content" },
      { name: "customEvent:qr_landing_page" },
    ],
    metrics: [{ name: "transactions" }, { name: "purchaseRevenue" }],
    dimensionFilter: buildPurchaseDimensionFilter(venue),
    keepEmptyRows: false,
    limit: 1000,
    orderBys: [
      {
        metric: {
          metricName: "purchaseRevenue",
        },
        desc: true,
      },
    ],
  });
}

async function runHostTrafficReport({ startDate, endDate, hostName }) {
  return runGaReport({
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
  });
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

function mapPurchaseRows(rows = [], startDate, endDate) {
  const purchases = new Map();

  for (const row of rows) {
    const dimensionValues = row.dimensionValues || [];
    const purchaseDateRaw = String(dimensionValues[0]?.value || "").trim();
    const purchaseDate = /^\d{8}$/.test(purchaseDateRaw)
      ? `${purchaseDateRaw.slice(0, 4)}-${purchaseDateRaw.slice(4, 6)}-${purchaseDateRaw.slice(6, 8)}`
      : purchaseDateRaw;

    if (!isDateWithinRange(purchaseDate, startDate, endDate)) {
      continue;
    }

    const utmContent = dimensionValues[1]?.value || "";
    const landingPage = normalizeLandingPage(dimensionValues[2]?.value || "");
    const key = buildRowKey(utmContent, landingPage);
    const existing = purchases.get(key) || { count: 0, revenue: 0 };

    purchases.set(key, {
      count: existing.count + Number(row.metricValues?.[0]?.value || 0),
      revenue: existing.revenue + Number(row.metricValues?.[1]?.value || 0),
    });
  }

  return purchases;
}

function mapRows(
  rows = [],
  ctaClicksByRow = new Map(),
  purchasesByRow = new Map(),
) {
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
      purchases: Number(purchasesByRow.get(key)?.count || 0),
      revenue: Number(purchasesByRow.get(key)?.revenue || 0),
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

export async function getQrDashboardSummary({
  startDate = DEFAULT_START_DATE,
  endDate = DEFAULT_END_DATE,
  venue = "",
} = {}) {
  const normalizedVenue = String(venue || "")
    .trim()
    .toLowerCase();
  const purchaseStartDate = getPurchaseQueryStartDate(startDate, endDate);

  const [
    report,
    ctaClickReport,
    ctaClickBreakdownReport,
    purchaseBreakdownReport,
    rootTrafficReport,
    passTrafficReport,
  ] = await Promise.all([
    runReport({
      startDate,
      endDate,
      venue: normalizedVenue,
    }),
    runEventCountReport({
      startDate,
      endDate,
      venue: normalizedVenue,
      eventNamePattern: CTA_CLICK_EVENT_NAME_PATTERN,
    }),
    runEventBreakdownReport({
      startDate,
      endDate,
      venue: normalizedVenue,
      eventNamePattern: CTA_CLICK_EVENT_NAME_PATTERN,
    }),
    runPurchaseBreakdownReport({
      startDate: purchaseStartDate,
      endDate,
      venue: normalizedVenue,
    }),
    runHostTrafficReport({
      startDate,
      endDate,
      hostName: ROOT_HOSTNAME,
    }),
    runHostTrafficReport({
      startDate,
      endDate,
      hostName: PASS_HOSTNAME,
    }),
  ]);

  const ctaClicksByRow = mapEventCountRows(ctaClickBreakdownReport.rows);
  const purchasesByRow = mapPurchaseRows(
    purchaseBreakdownReport.rows,
    startDate,
    endDate,
  );

  return {
    rows: mapRows(report.rows, ctaClicksByRow, purchasesByRow),
    rootTrafficRows: [mapHostTrafficReport(rootTrafficReport, ROOT_HOSTNAME)],
    passTrafficRows: [mapHostTrafficReport(passTrafficReport, PASS_HOSTNAME)],
    stats: {
      ctaClick: getEventCountFromReport(ctaClickReport),
    },
  };
}
