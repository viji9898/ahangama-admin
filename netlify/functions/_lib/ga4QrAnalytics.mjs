import { GoogleAuth } from "google-auth-library";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { query } from "./db.mjs";
import { VENUES_TABLE } from "./venues260414.mjs";

const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API_BASE_URL = "https://analyticsdata.googleapis.com/v1beta";
const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";
const CTA_CLICK_EVENT_NAME_PATTERN = "(^|_)cta_click$";
const PURCHASE_EVENT_NAME = "purchase";
const QR_FUNNEL_VIEW_EVENT_NAME = "qr_venue_page_view";
const QR_FUNNEL_CLICK_EVENT_NAME = "qr_pass_cta_click";
const PURCHASE_LOOKBACK_DAYS = 7;
const ROOT_HOSTNAME = "ahangama.com";
const PASS_HOSTNAME = "pass.ahangama.com";
const QR_SCAN_VENUE_ALIASES = {
  abrazo: "abrazo-ahangama",
  aliikai: "aliikai-ahangama",
  "cinnamon-trails": "the-cinnamon-trails-ahangama",
  "co-live": "colive",
  donna: "donna-ahangama",
  "folklore-ag": "folklore-ahangama",
  frostys: "frostys-recovery-centre-hangout",
  "hakuna-matata": "hakuna-matata-ahangama",
  "jam-house": "jam-house-ahangama",
  kaffi: "kaffi-ahangama",
  "kaffi-ag": "kaffi-ahangama",
  "kaffi-pr-cmb": "kaffi-ahangama",
  "kaffi-pr-colombo": "kaffi-ahangama",
  "makai-cafe": "makai-cafe-ahangama",
  "mana-villa": "mana",
  "maria-bonita": "maria-bonita-sri-lanka",
  "mora-rooftop": "mora-rooftop-lounge",
  "mudra-herbal": "mudra-herbal-spicy-tea-shop",
  "o-yummy": "oyummy",
  "palm-g": "ayurveda-palm-garden-resort",
  "paradise-cove": "paradise-cove-midigama",
  "pura-pilates": "pura-pilates-ahangama",
  "roaming-retreat": "roaming-retreat-cafe-hostel-villa",
  "sama-1": "sama",
  "sama-2": "sama",
  "sama-4": "sama",
  samba: "samba-ahangama",
  unu: "unu-boutique-hotel",
  "younger-villas": "younger-villas-resorts",
};

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

function resolveVenueSlug(value = "") {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  return QR_SCAN_VENUE_ALIASES[normalizedValue] || normalizedValue;
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

function buildCustomEventFilter(fieldName, value, matchType = "EXACT") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType,
        value: normalizedValue,
      },
    },
  };
}

function normalizeCustomDimensionValue(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (
    !normalizedValue ||
    normalizedValue === "(not set)" ||
    normalizedValue === "unknown"
  ) {
    return "";
  }

  return normalizedValue;
}

function buildQrFunnelEventFilter({ eventName, extraExpressions = [] }) {
  return {
    andGroup: {
      expressions: [
        {
          filter: {
            fieldName: "eventName",
            stringFilter: {
              matchType: "EXACT",
              value: eventName,
            },
          },
        },
        ...extraExpressions.filter(Boolean),
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

async function runPurchaseVenueBreakdownReport({ startDate, endDate }) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "customEvent:qr_venue" }],
    metrics: [{ name: "transactions" }, { name: "purchaseRevenue" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "eventName",
              stringFilter: {
                matchType: "EXACT",
                value: PURCHASE_EVENT_NAME,
              },
            },
          },
        ],
      },
    },
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

async function runTotalPurchaseReport({ startDate, endDate }) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "transactions" }, { name: "purchaseRevenue" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: {
          matchType: "EXACT",
          value: PURCHASE_EVENT_NAME,
        },
      },
    },
    keepEmptyRows: false,
    limit: 1,
  });
}

async function runQrFunnelBreakdownReport({
  startDate,
  endDate,
  eventName,
  dimensionName,
  dimensionNames,
  metrics,
  extraExpressions = [],
  orderByMetricName,
}) {
  return runGaReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: (Array.isArray(dimensionNames) && dimensionNames.length
      ? dimensionNames
      : [dimensionName]
    ).map((name) => ({ name })),
    metrics,
    dimensionFilter: buildQrFunnelEventFilter({
      eventName,
      extraExpressions,
    }),
    keepEmptyRows: false,
    limit: 1000,
    orderBys: orderByMetricName
      ? [
          {
            metric: {
              metricName: orderByMetricName,
            },
            desc: true,
          },
        ]
      : [],
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

function mapPurchaseVenueRows(rows = [], startDate, endDate) {
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

    const rawVenue = String(dimensionValues[1]?.value || "")
      .trim()
      .toLowerCase();

    if (!rawVenue) {
      continue;
    }

    const venueKey = resolveVenueSlug(rawVenue);
    const existing = purchases.get(venueKey) || {
      count: 0,
      revenue: 0,
      sourceVenues: new Set(),
    };

    existing.count += Number(row.metricValues?.[0]?.value || 0);
    existing.revenue += Number(row.metricValues?.[1]?.value || 0);
    existing.sourceVenues.add(rawVenue);

    purchases.set(venueKey, existing);
  }

  return purchases;
}

function mapRows(
  rows = [],
  ctaClicksByRow = new Map(),
  purchasesByRow = new Map(),
  purchasesByVenue = new Map(),
) {
  const groupedRows = new Map();
  const directPurchasesByVenue = new Map();

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

    const resolvedVenue = resolveVenueSlug(parsed.venue || "unknown");
    const directPurchase = purchasesByRow.get(key);

    if (directPurchase) {
      const existingVenuePurchase = directPurchasesByVenue.get(resolvedVenue) || {
        count: 0,
        revenue: 0,
      };

      directPurchasesByVenue.set(resolvedVenue, {
        count: existingVenuePurchase.count + Number(directPurchase.count || 0),
        revenue:
          existingVenuePurchase.revenue + Number(directPurchase.revenue || 0),
      });
    }
  }

  for (const [venueKey, venuePurchase] of purchasesByVenue.entries()) {
    const directPurchase = directPurchasesByVenue.get(venueKey) || {
      count: 0,
      revenue: 0,
    };
    const remainingCount = Number(venuePurchase.count || 0) - directPurchase.count;
    const remainingRevenue =
      Number(venuePurchase.revenue || 0) - directPurchase.revenue;

    if (remainingCount <= 0 && remainingRevenue <= 0) {
      continue;
    }

    let targetRow = null;

    for (const row of groupedRows.values()) {
      if (resolveVenueSlug(row.venue || "unknown") !== venueKey) {
        continue;
      }

      if (!targetRow || Number(row.sessions || 0) > Number(targetRow.sessions || 0)) {
        targetRow = row;
      }
    }

    if (!targetRow) {
      continue;
    }

    // Fallback to venue-level attribution when purchase events do not carry qr_content.
    targetRow.purchases += Math.max(remainingCount, 0);
    targetRow.revenue += Math.max(remainingRevenue, 0);
  }

  return [...groupedRows.values()];
}

async function getVenueDirectory() {
  const result = await query(
    `
      SELECT slug, name, area, lat, lng
      FROM ${VENUES_TABLE}
      WHERE deleted_at IS NULL
        AND lat IS NOT NULL
        AND lng IS NOT NULL
    `,
  );

  return new Map(
    result.rows.map((row) => [
      String(row.slug || "")
        .trim()
        .toLowerCase(),
      {
        slug: String(row.slug || "")
          .trim()
          .toLowerCase(),
        name: String(row.name || "").trim(),
        area: String(row.area || "").trim(),
        lat: Number(row.lat),
        lng: Number(row.lng),
      },
    ]),
  );
}

function buildScanMapRows(rows = [], venueDirectory = new Map()) {
  const groupedRows = new Map();

  for (const row of rows) {
    const sourceVenue = String(row.venue || "")
      .trim()
      .toLowerCase();

    if (!sourceVenue) {
      continue;
    }

    const resolvedVenueSlug = resolveVenueSlug(sourceVenue);
    const venueRecord = venueDirectory.get(resolvedVenueSlug);

    if (!venueRecord) {
      continue;
    }

    const existing = groupedRows.get(resolvedVenueSlug);
    const sessions = Number(row.sessions || 0);
    const users = Number(row.users || 0);
    const events = Number(row.events || 0);
    const ctaClick = Number(row.ctaClick || 0);
    const purchases = Number(row.purchases || 0);
    const revenue = Number(row.revenue || 0);
    const surface = String(row.surface || "unknown")
      .trim()
      .toLowerCase() || "unknown";

    if (existing) {
      existing.sessions += sessions;
      existing.users += users;
      existing.events += events;
      existing.ctaClick += ctaClick;
      existing.purchases += purchases;
      existing.revenue += revenue;
      existing.sourceVenues.add(sourceVenue);
      existing.surfaces.set(
        surface,
        Number(existing.surfaces.get(surface) || 0) + sessions,
      );
      continue;
    }

    groupedRows.set(resolvedVenueSlug, {
      slug: venueRecord.slug,
      label: venueRecord.name || resolvedVenueSlug,
      area: venueRecord.area,
      lat: venueRecord.lat,
      lng: venueRecord.lng,
      sessions,
      users,
      events,
      ctaClick,
      purchases,
      revenue,
      sourceVenues: new Set([sourceVenue]),
      surfaces: new Map([[surface, sessions]]),
    });
  }

  return [...groupedRows.values()]
    .map((row) => ({
      slug: row.slug,
      label: row.label,
      area: row.area,
      lat: row.lat,
      lng: row.lng,
      sessions: row.sessions,
      users: row.users,
      events: row.events,
      ctaClick: row.ctaClick,
      purchases: row.purchases,
      revenue: row.revenue,
      conversionRate: row.sessions > 0 ? row.ctaClick / row.sessions : 0,
      purchaseRate: row.sessions > 0 ? row.purchases / row.sessions : 0,
      sourceVenues: [...row.sourceVenues].sort((left, right) =>
        left.localeCompare(right),
      ),
      topSurfaces: [...row.surfaces.entries()]
        .map(([surface, surfaceSessions]) => ({ surface, sessions: surfaceSessions }))
        .sort(
          (left, right) =>
            right.sessions - left.sessions ||
            left.surface.localeCompare(right.surface),
        )
        .slice(0, 4),
    }))
    .sort((left, right) => right.sessions - left.sessions);
}

function getEventCountFromReport(report) {
  return Number(report?.rows?.[0]?.metricValues?.[0]?.value || 0);
}

function getPurchaseTotalsFromReport(report) {
  return {
    purchases: Number(report?.rows?.[0]?.metricValues?.[0]?.value || 0),
    revenue: Number(report?.rows?.[0]?.metricValues?.[1]?.value || 0),
  };
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

function createEmptyQrFunnel(error = "") {
  return {
    available: false,
    error,
    totals: {
      views: 0,
      clicks: 0,
      purchases: 0,
      revenue: 0,
      viewToClickRate: 0,
      clickToPurchaseRate: 0,
      viewToPurchaseRate: 0,
    },
    rows: [],
  };
}

function upsertQrFunnelRow(groupedRows, venueDirectory, key, rawVenue = "") {
  const normalizedKey = String(key || "unknown")
    .trim()
    .toLowerCase() || "unknown";
  const existing = groupedRows.get(normalizedKey);

  if (existing) {
    if (rawVenue) {
      existing.sourceVenues.add(rawVenue);
    }
    return existing;
  }

  const venueRecord = venueDirectory.get(normalizedKey);
  const next = {
    key: normalizedKey,
    venueSlug: normalizedKey,
    label:
      venueRecord?.name ||
      rawVenue ||
      (normalizedKey === "unattributed" ? "Unattributed" : normalizedKey),
    qrVenue: rawVenue || normalizedKey,
    views: 0,
    clicks: 0,
    purchases: 0,
    revenue: 0,
    sourceVenues: new Set(rawVenue ? [rawVenue] : []),
    purchaseLandingPages: new Set(),
    promoTypes: new Set(),
    purchaseVenueSlugs: new Set(),
    purchaseAttributionSource: "qr_venue",
  };

  groupedRows.set(normalizedKey, next);

  return next;
}

function buildQrFunnelRows({
  viewRows = [],
  clickRows = [],
  purchaseRows = [],
  venueDirectory = new Map(),
  venue = "",
}) {
  const groupedRows = new Map();

  for (const row of viewRows) {
    const rawVenue = String(row.dimensionValues?.[0]?.value || "").trim();
    const venueKey = resolveVenueSlug(rawVenue || "unknown");
    const grouped = upsertQrFunnelRow(groupedRows, venueDirectory, venueKey, rawVenue);

    grouped.views += Number(row.metricValues?.[0]?.value || 0);
  }

  for (const row of clickRows) {
    const rawVenue = String(row.dimensionValues?.[0]?.value || "").trim();
    const venueKey = resolveVenueSlug(rawVenue || "unknown");
    const grouped = upsertQrFunnelRow(groupedRows, venueDirectory, venueKey, rawVenue);

    grouped.clicks += Number(row.metricValues?.[0]?.value || 0);
  }

  for (const row of purchaseRows) {
    const rawQrVenue = String(row.dimensionValues?.[0]?.value || "").trim();
    const rawLandingPage = String(row.dimensionValues?.[1]?.value || "").trim();
    const rawPromoType = String(row.dimensionValues?.[2]?.value || "").trim();
    const rawVenueSlug = String(row.dimensionValues?.[3]?.value || "").trim();
    const normalizedQrVenue = normalizeCustomDimensionValue(rawQrVenue);
    const normalizedVenueSlug = normalizeCustomDimensionValue(rawVenueSlug);
    const normalizedLandingPage = normalizeCustomDimensionValue(rawLandingPage);
    const normalizedPromoType = normalizeCustomDimensionValue(rawPromoType);
    const baseVenue = normalizedQrVenue || normalizedVenueSlug || "unattributed";
    const venueKey = resolveVenueSlug(baseVenue);
    const grouped = upsertQrFunnelRow(
      groupedRows,
      venueDirectory,
      venueKey,
      rawQrVenue || rawVenueSlug,
    );

    grouped.purchases += Number(row.metricValues?.[0]?.value || 0);
    grouped.revenue += Number(row.metricValues?.[1]?.value || 0);

    if (normalizedLandingPage) {
      grouped.purchaseLandingPages.add(rawLandingPage);
    }

    if (normalizedPromoType) {
      grouped.promoTypes.add(rawPromoType);
    }

    if (normalizedVenueSlug) {
      grouped.purchaseVenueSlugs.add(rawVenueSlug);
    }

    if (!normalizedQrVenue && normalizedVenueSlug) {
      grouped.purchaseAttributionSource = "venue_slug_fallback";
      grouped.qrVenue = rawVenueSlug;
    } else if (!normalizedQrVenue && !normalizedVenueSlug) {
      grouped.purchaseAttributionSource = "unattributed";
      grouped.qrVenue = "unattributed";
      grouped.label = "Unattributed";
    }
  }

  const normalizedVenue = String(venue || "")
    .trim()
    .toLowerCase();
  const resolvedVenue = normalizedVenue
    ? resolveVenueSlug(normalizedVenue)
    : "";

  return [...groupedRows.values()]
    .filter((row) => {
      if (!normalizedVenue) {
        return true;
      }

      return (
        row.venueSlug === resolvedVenue || row.sourceVenues.has(normalizedVenue)
      );
    })
    .map((row) => {
      const views = Number(row.views || 0);
      const clicks = Number(row.clicks || 0);
      const purchases = Number(row.purchases || 0);

      return {
        key: row.key,
        venueSlug: row.venueSlug,
        label: row.label,
        qrVenue: row.qrVenue,
        views,
        clicks,
        purchases,
        revenue: Number(row.revenue || 0),
        viewToClickRate: views > 0 ? clicks / views : 0,
        clickToPurchaseRate: clicks > 0 ? purchases / clicks : 0,
        viewToPurchaseRate: views > 0 ? purchases / views : 0,
        sourceVenues: [...row.sourceVenues].sort((left, right) =>
          left.localeCompare(right),
        ),
        purchaseLandingPages: [...row.purchaseLandingPages].sort((left, right) =>
          left.localeCompare(right),
        ),
        promoTypes: [...row.promoTypes].sort((left, right) =>
          left.localeCompare(right),
        ),
        purchaseVenueSlugs: [...row.purchaseVenueSlugs].sort((left, right) =>
          left.localeCompare(right),
        ),
        purchaseAttributionSource: row.purchaseAttributionSource,
      };
    })
    .sort(
      (left, right) =>
        right.purchases - left.purchases ||
        right.clicks - left.clicks ||
        right.views - left.views ||
        left.label.localeCompare(right.label),
    );
}

function buildQrFunnelTotals(rows = []) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      views: accumulator.views + Number(row.views || 0),
      clicks: accumulator.clicks + Number(row.clicks || 0),
      purchases: accumulator.purchases + Number(row.purchases || 0),
      revenue: accumulator.revenue + Number(row.revenue || 0),
    }),
    { views: 0, clicks: 0, purchases: 0, revenue: 0 },
  );

  return {
    ...totals,
    viewToClickRate: totals.views > 0 ? totals.clicks / totals.views : 0,
    clickToPurchaseRate:
      totals.clicks > 0 ? totals.purchases / totals.clicks : 0,
    viewToPurchaseRate:
      totals.views > 0 ? totals.purchases / totals.views : 0,
  };
}

async function getQrFunnelSummary({
  startDate,
  endDate,
  venue = "",
  venueDirectory = new Map(),
} = {}) {
  try {
    const [viewReport, clickReport, purchaseReport] = await Promise.all([
      runQrFunnelBreakdownReport({
        startDate,
        endDate,
        eventName: QR_FUNNEL_VIEW_EVENT_NAME,
        dimensionName: "customEvent:qr_venue",
        metrics: [{ name: "eventCount" }],
        orderByMetricName: "eventCount",
      }),
      runQrFunnelBreakdownReport({
        startDate,
        endDate,
        eventName: QR_FUNNEL_CLICK_EVENT_NAME,
        dimensionName: "customEvent:qr_venue",
        metrics: [{ name: "eventCount" }],
        orderByMetricName: "eventCount",
      }),
      runQrFunnelBreakdownReport({
        startDate,
        endDate,
        eventName: PURCHASE_EVENT_NAME,
        dimensionNames: [
          "customEvent:qr_venue",
          "customEvent:qr_landing_page",
          "customEvent:promo_type",
          "customEvent:venue_slug",
        ],
        metrics: [{ name: "transactions" }, { name: "purchaseRevenue" }],
        orderByMetricName: "transactions",
      }),
    ]);

    const rows = buildQrFunnelRows({
      viewRows: viewReport?.rows,
      clickRows: clickReport?.rows,
      purchaseRows: purchaseReport?.rows,
      venueDirectory,
      venue,
    });

    return {
      available: true,
      error: "",
      totals: buildQrFunnelTotals(rows),
      rows,
    };
  } catch (error) {
    return createEmptyQrFunnel(String(error?.message || error));
  }
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
    purchaseVenueBreakdownReport,
    totalPurchaseReport,
    rootTrafficReport,
    passTrafficReport,
    venueDirectory,
    funnel,
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
    runPurchaseVenueBreakdownReport({
      startDate: purchaseStartDate,
      endDate,
    }),
    runTotalPurchaseReport({
      startDate,
      endDate,
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
    getVenueDirectory(),
    getVenueDirectory().then((resolvedVenueDirectory) =>
      getQrFunnelSummary({
        startDate,
        endDate,
        venue: normalizedVenue,
        venueDirectory: resolvedVenueDirectory,
      }),
    ),
  ]);

  const ctaClicksByRow = mapEventCountRows(ctaClickBreakdownReport.rows);
  const purchasesByRow = mapPurchaseRows(
    purchaseBreakdownReport.rows,
    startDate,
    endDate,
  );
  const purchasesByVenue = mapPurchaseVenueRows(
    purchaseVenueBreakdownReport.rows,
    startDate,
    endDate,
  );
  const rows = mapRows(
    report.rows,
    ctaClicksByRow,
    purchasesByRow,
    purchasesByVenue,
  );
  const totalPurchaseStats = getPurchaseTotalsFromReport(totalPurchaseReport);

  return {
    rows,
    funnel,
    scanMapRows: buildScanMapRows(rows, venueDirectory),
    rootTrafficRows: [mapHostTrafficReport(rootTrafficReport, ROOT_HOSTNAME)],
    passTrafficRows: [mapHostTrafficReport(passTrafficReport, PASS_HOSTNAME)],
    stats: {
      ctaClick: getEventCountFromReport(ctaClickReport),
      totalPurchases: totalPurchaseStats.purchases,
      totalRevenue: totalPurchaseStats.revenue,
    },
  };
}
