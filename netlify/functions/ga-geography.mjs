import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import {
  mapGeographyRows,
  mapGeographyTotals,
  resolveGeographyPeriod,
} from "./_lib/gaGeography.mjs";
import { runGaReport } from "./_lib/ga4QrAnalytics.mjs";
import { attachGeographyCoordinates } from "./_lib/geographyCoordinates.mjs";

const CACHE_TTL_MS = 60 * 60 * 1000;
const responseCache = new Map();

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  },
  body: JSON.stringify(body),
});

function hostFilter(hostName) {
  return {
    filter: {
      fieldName: "hostName",
      stringFilter: { matchType: "EXACT", value: hostName },
    },
  };
}

async function loadGeography(period, hostName) {
  const dateRanges = [{ startDate: `${period - 1}daysAgo`, endDate: "today" }];
  const metrics = [{ name: "activeUsers" }, { name: "sessions" }];
  const dimensionFilter = hostFilter(hostName);
  const [totalsReport, locationsReport] = await Promise.all([
    runGaReport({ dateRanges, metrics, dimensionFilter }),
    runGaReport({
      dateRanges,
      dimensions: [
        { name: "country" },
        { name: "region" },
        { name: "city" },
      ],
      metrics,
      dimensionFilter,
      keepEmptyRows: false,
      limit: 10000,
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    }),
  ]);
  const totals = mapGeographyTotals(totalsReport);
  const rawLocations = mapGeographyRows(locationsReport, totals.activeUsers);
  const coordinates = await attachGeographyCoordinates(rawLocations);

  return {
    ok: true,
    period,
    hostName,
    generatedAt: new Date().toISOString(),
    totals: {
      ...totals,
      countries: new Set(rawLocations.map((location) => location.country)).size,
    },
    ...coordinates,
  };
}

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }
    requireAdmin(event);
    const period = resolveGeographyPeriod(event.queryStringParameters?.period);
    const hostName = String(process.env.GA4_HOST_NAME || "ahangama.com").trim();
    const cacheKey = `${hostName}:${period}`;
    const cached = responseCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) return json(200, cached.payload);

    const payload = await loadGeography(period, hostName);
    responseCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return json(200, payload);
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export default modernHandler(handler);