import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import {
  getGaMetadata,
  runGaReport,
} from "./_lib/ga4QrAnalytics.mjs";

const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";

const DIMENSION_FIELDS = {
  eventName: "eventName",
  "customEvent:venue_id": "venueId",
  "customEvent:venue_name": "venueName",
  "customEvent:guide_section": "guideSection",
  "customEvent:link_type": "linkType",
  "customEvent:component_location": "componentLocation",
  "customEvent:target_section": "targetSection",
  "customEvent:selected_filter": "selectedFilter",
  "customEvent:map_category": "mapCategory",
};

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

function dimensionValue(row, index) {
  const value = String(row?.dimensionValues?.[index]?.value || "").trim();
  return value === "(not set)" ? "" : value;
}

function mapRows(report) {
  const dimensionHeaders = report?.dimensionHeaders || [];

  return (report?.rows || []).map((row, index) => {
    const dimensionValues = Object.fromEntries(
      dimensionHeaders.map(({ name }, dimensionIndex) => [
        DIMENSION_FIELDS[name],
        dimensionValue(row, dimensionIndex),
      ]),
    );

    return {
      key: `${index}:${row.dimensionValues?.map(({ value }) => value).join(":")}`,
      eventName: "",
      venueId: "",
      venueSlug: "",
      venueName: "",
      guideSection: "",
      linkType: "",
      componentLocation: "",
      targetSection: "",
      selectedFilter: "",
      mapCategory: "",
      ...dimensionValues,
      eventCount: Number(row?.metricValues?.[0]?.value || 0),
      users: Number(row?.metricValues?.[1]?.value || 0),
    };
  });
}

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const { startDate, endDate } = getDateRange(
      event.queryStringParameters || {},
    );
    const metadata = await getGaMetadata();
    const availableDimensionNames = new Set(
      (metadata?.dimensions || []).map(({ apiName }) => apiName),
    );
    const requestedDimensions = Object.keys(DIMENSION_FIELDS);
    const dimensions = requestedDimensions.filter((name) =>
      availableDimensionNames.has(name),
    );
    const missingDimensions = requestedDimensions.filter(
      (name) => name !== "eventName" && !availableDimensionNames.has(name),
    );
    const report = await runGaReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: {
            matchType: "BEGINS_WITH",
            value: "guide_",
            caseSensitive: true,
          },
        },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      metricAggregations: ["TOTAL"],
      keepEmptyRows: false,
      limit: 10000,
    });

    const totalMetrics = report?.totals?.[0]?.metricValues || [];

    return json(200, {
      ok: true,
      startDate,
      endDate,
      totals: {
        eventCount: Number(totalMetrics[0]?.value || 0),
        users: Number(totalMetrics[1]?.value || 0),
      },
      missingDimensions,
      rows: mapRows(report),
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export default modernHandler(handler);