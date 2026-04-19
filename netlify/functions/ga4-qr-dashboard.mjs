import { GoogleAuth } from "google-auth-library";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { requireAdmin } from "./_lib/auth.mjs";

const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API_BASE_URL = "https://analyticsdata.googleapis.com/v1beta";
const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";
const PASS_CTA_CLICK_EVENT_NAME = "pass_cta_click";

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

function buildDimensionFilter(queryStringParameters = {}) {
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

  return {
    andGroup: {
      expressions,
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

function buildEventNameFilter(eventName, queryStringParameters = {}) {
  const expressions = [
    {
      filter: {
        fieldName: "eventName",
        stringFilter: {
          matchType: "EXACT",
          value: eventName,
        },
      },
    },
  ];

  const venueFilter = buildVenueFilter(queryStringParameters);

  if (venueFilter) {
    expressions.push(venueFilter);
  }

  return {
    andGroup: {
      expressions,
    },
  };
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

async function runEventCountByNameReport({
  propertyId,
  startDate,
  endDate,
  venue,
  eventName,
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
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: buildEventNameFilter(eventName, { venue }),
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

function mapRows(rows = []) {
  return rows.map((row) => {
    const dimensionValues = row.dimensionValues || [];
    const metricValues = row.metricValues || [];
    const utmContent = dimensionValues[0]?.value || "";
    const landingPage = dimensionValues[1]?.value || "";
    const parsed = parseUtmContent(utmContent);

    return {
      venue: parsed.venue,
      surface: parsed.surface,
      creative: parsed.creative,
      sessions: Number(metricValues[0]?.value || 0),
      users: Number(metricValues[1]?.value || 0),
      events: Number(metricValues[2]?.value || 0),
      landingPage,
    };
  });
}

function getEventCountFromReport(report) {
  return Number(report?.rows?.[0]?.metricValues?.[0]?.value || 0);
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

    const [report, passCtaClickReport] = await Promise.all([
      runReport({
        propertyId,
        startDate,
        endDate,
        venue,
      }),
      runEventCountByNameReport({
        propertyId,
        startDate,
        endDate,
        venue,
        eventName: PASS_CTA_CLICK_EVENT_NAME,
      }),
    ]);

    return json(200, {
      rows: mapRows(report.rows),
      stats: {
        passCtaClick: getEventCountFromReport(passCtaClickReport),
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
