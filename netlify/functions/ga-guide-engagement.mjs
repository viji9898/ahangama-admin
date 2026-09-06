import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { getGaMetadata, runGaReport } from "./_lib/ga4QrAnalytics.mjs";

const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";
const HOST_NAME = "ahangama.com";
const GUIDE_PATH = "/guide/";
const IMPRESSION_EVENT = "venue_impression";
const OUTBOUND_EVENT = "guide_outbound_click";
const VENUE_ENGAGEMENT_EVENTS = [
  "guide_lightbox_open",
  "guide_map_marker_select",
];

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

const VENUE_DIMENSIONS = [
  "customEvent:venue_id",
  "customEvent:venue_slug",
  "customEvent:venue_name",
];

const REQUESTED_VENUE_DIMENSIONS = [
  ...VENUE_DIMENSIONS,
  "customEvent:guide_section",
  "customEvent:component_location",
  "customEvent:position",
  "customEvent:page_type",
  "customEvent:content_id",
  "customEvent:content_type",
  "customEvent:placement",
];

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

function metricValue(row, index) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function exactFilter(fieldName, value) {
  return {
    filter: {
      fieldName,
      stringFilter: { matchType: "EXACT", value, caseSensitive: true },
    },
  };
}

function eventFilter(eventName, { guideOnly = false } = {}) {
  const expressions = [
    exactFilter("hostName", HOST_NAME),
    exactFilter("eventName", eventName),
  ];

  if (guideOnly) expressions.push(exactFilter("pagePath", GUIDE_PATH));

  return { andGroup: { expressions } };
}

function engagementFilter() {
  return {
    andGroup: {
      expressions: [
        exactFilter("hostName", HOST_NAME),
        {
          orGroup: {
            expressions: VENUE_ENGAGEMENT_EVENTS.map((eventName) =>
              exactFilter("eventName", eventName),
            ),
          },
        },
      ],
    },
  };
}

function reportRows(report) {
  return (report?.rows || []).map((row) => ({
    dimensions: (row.dimensionValues || []).map((_, index) =>
      dimensionValue(row, index),
    ),
    eventCount: metricValue(row, 0),
    users: metricValue(row, 1),
  }));
}

function totals(report) {
  const row = report?.rows?.[0];
  return { eventCount: metricValue(row, 0), users: metricValue(row, 1) };
}

function normalizeActionType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "instagram") return "instagram";
  if (normalized === "google_maps" || normalized === "directions") {
    return "directions";
  }
  if (normalized === "website") return "website";
  return "unclassified";
}

function venueKey(venueId) {
  return venueId || "__missing_venue_id";
}

function getVenue(grouped, venueId, venueSlug, venueName) {
  const key = venueKey(venueId);
  if (!grouped.has(key)) {
    grouped.set(key, {
      key,
      venueId,
      venueSlug: venueId ? venueSlug : "",
      venueName: venueId ? venueName || venueSlug || venueId : "Unattributed",
      impressions: 0,
      usersExposed: 0,
      engagements: 0,
      usersEngaged: 0,
      lightboxOpens: 0,
      otherInteractions: 0,
      instagram: 0,
      directions: 0,
      website: 0,
      unclassified: 0,
      totalActions: 0,
    });
  }

  const venue = grouped.get(key);
  if (venueId && !venue.venueSlug && venueSlug) venue.venueSlug = venueSlug;
  if ((!venue.venueName || venue.venueName === venue.venueId) && venueName) {
    venue.venueName = venueName;
  }
  return venue;
}

function buildVenueRows(
  impressionReport,
  engagementReport,
  engagementUsersReport,
  actionReport,
) {
  const grouped = new Map();

  for (const row of reportRows(impressionReport)) {
    const [venueId, venueSlug, venueName] = row.dimensions;
    const venue = getVenue(grouped, venueId, venueSlug, venueName);
    venue.impressions += row.eventCount;
    venue.usersExposed = row.users;
  }

  for (const row of reportRows(engagementReport)) {
    const [venueId, venueSlug, venueName, eventName] = row.dimensions;
    const venue = getVenue(grouped, venueId, venueSlug, venueName);
    venue.engagements += row.eventCount;
    if (eventName === "guide_lightbox_open") {
      venue.lightboxOpens += row.eventCount;
    } else {
      venue.otherInteractions += row.eventCount;
    }
  }

  for (const row of reportRows(engagementUsersReport)) {
    const [venueId, venueSlug, venueName] = row.dimensions;
    const venue = getVenue(grouped, venueId, venueSlug, venueName);
    venue.usersEngaged = row.users;
  }

  for (const row of reportRows(actionReport)) {
    const [venueId, venueSlug, venueName, linkType] = row.dimensions;
    const venue = getVenue(grouped, venueId, venueSlug, venueName);
    const actionType = normalizeActionType(linkType);
    venue[actionType] += row.eventCount;
    venue.totalActions += row.eventCount;
  }

  return [...grouped.values()].sort(
    (left, right) =>
      right.impressions - left.impressions ||
      right.totalActions - left.totalActions ||
      left.venueName.localeCompare(right.venueName),
  );
}

function buildBreakdown(impressionsReport, actionsReport) {
  const grouped = new Map();

  for (const row of reportRows(impressionsReport)) {
    const label = row.dimensions[0] || "Unclassified";
    grouped.set(label, {
      key: label,
      label,
      impressions: row.eventCount,
      users: row.users,
      actions: 0,
    });
  }

  for (const row of reportRows(actionsReport)) {
    const label = row.dimensions[0] || "Unclassified";
    const item = grouped.get(label) || {
      key: label,
      label,
      impressions: 0,
      users: 0,
      actions: 0,
    };
    item.actions += row.eventCount;
    grouped.set(label, item);
  }

  return [...grouped.values()].sort(
    (left, right) =>
      right.impressions - left.impressions || right.actions - left.actions,
  );
}

function buildTimeSeries(impressionsReport, actionsReport) {
  const grouped = new Map();
  const addRows = (report, metric) => {
    for (const row of reportRows(report)) {
      const [date, venueId, venueSlug, venueName] = row.dimensions;
      const key = `${date}:${venueKey(venueId)}`;
      const item = grouped.get(key) || {
        key,
        date,
        venueId,
        venueSlug,
        venueName: venueName || (venueId ? venueSlug || venueId : "Unattributed"),
        impressions: 0,
        actions: 0,
      };
      item[metric] += row.eventCount;
      grouped.set(key, item);
    }
  };

  addRows(impressionsReport, "impressions");
  addRows(actionsReport, "actions");
  return [...grouped.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function missingCount(report, dimensionIndex) {
  return reportRows(report).reduce(
    (total, row) => total + (row.dimensions[dimensionIndex] ? 0 : row.eventCount),
    0,
  );
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
    const dateRanges = [{ startDate, endDate }];
    const venueMetrics = [{ name: "eventCount" }, { name: "totalUsers" }];
    const impressionFilter = eventFilter(IMPRESSION_EVENT, { guideOnly: true });
    const outboundFilter = eventFilter(OUTBOUND_EVENT);
    const positionAvailable = availableDimensionNames.has(
      "customEvent:position",
    );
    const reportPromise = runGaReport({
      dateRanges,
      dimensions: dimensions.map((name) => ({ name })),
      metrics: venueMetrics,
      dimensionFilter: {
        orGroup: {
          expressions: [
            {
              filter: {
                fieldName: "eventName",
                stringFilter: {
                  matchType: "BEGINS_WITH",
                  value: "guide_",
                  caseSensitive: true,
                },
              },
            },
            exactFilter("eventName", IMPRESSION_EVENT),
          ],
        },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      metricAggregations: ["TOTAL"],
      keepEmptyRows: false,
      limit: 10000,
    });
    const report = await reportPromise;
    const [
      impressionTotalsReport,
      impressionVenueReport,
      engagementTotalsReport,
      engagementVenueReport,
      engagementUsersReport,
      actionTotalsReport,
      actionVenueReport,
      sectionImpressionReport,
      sectionActionReport,
      componentImpressionReport,
      componentActionReport,
      impressionTimeReport,
      actionTimeReport,
      impressionQaReport,
      actionQaReport,
      positionImpressionReport,
      positionActionReport,
    ] = await Promise.all([
      runGaReport({ dateRanges, metrics: venueMetrics, dimensionFilter: impressionFilter }),
      runGaReport({ dateRanges, dimensions: VENUE_DIMENSIONS.map((name) => ({ name })), metrics: venueMetrics, dimensionFilter: impressionFilter, limit: 10000 }),
      runGaReport({ dateRanges, metrics: venueMetrics, dimensionFilter: engagementFilter() }),
      runGaReport({ dateRanges, dimensions: [...VENUE_DIMENSIONS, "eventName"].map((name) => ({ name })), metrics: venueMetrics, dimensionFilter: engagementFilter(), limit: 10000 }),
      runGaReport({ dateRanges, dimensions: VENUE_DIMENSIONS.map((name) => ({ name })), metrics: venueMetrics, dimensionFilter: engagementFilter(), limit: 10000 }),
      runGaReport({ dateRanges, metrics: venueMetrics, dimensionFilter: outboundFilter }),
      runGaReport({ dateRanges, dimensions: [...VENUE_DIMENSIONS, "customEvent:link_type"].map((name) => ({ name })), metrics: venueMetrics, dimensionFilter: outboundFilter, limit: 10000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "customEvent:guide_section" }], metrics: venueMetrics, dimensionFilter: impressionFilter, limit: 1000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "customEvent:guide_section" }], metrics: venueMetrics, dimensionFilter: outboundFilter, limit: 1000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "customEvent:component_location" }], metrics: venueMetrics, dimensionFilter: impressionFilter, limit: 1000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "customEvent:component_location" }], metrics: venueMetrics, dimensionFilter: outboundFilter, limit: 1000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "date" }, ...VENUE_DIMENSIONS.map((name) => ({ name }))], metrics: [{ name: "eventCount" }], dimensionFilter: impressionFilter, limit: 10000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "date" }, ...VENUE_DIMENSIONS.map((name) => ({ name }))], metrics: [{ name: "eventCount" }], dimensionFilter: outboundFilter, limit: 10000 }),
      runGaReport({ dateRanges, dimensions: VENUE_DIMENSIONS.map((name) => ({ name })), metrics: venueMetrics, dimensionFilter: impressionFilter, limit: 10000 }),
      runGaReport({ dateRanges, dimensions: [{ name: "customEvent:venue_id" }, { name: "customEvent:link_type" }], metrics: venueMetrics, dimensionFilter: outboundFilter, limit: 10000 }),
      positionAvailable
        ? runGaReport({ dateRanges, dimensions: [{ name: "customEvent:position" }], metrics: venueMetrics, dimensionFilter: impressionFilter, limit: 1000 })
        : Promise.resolve(null),
      positionAvailable
        ? runGaReport({ dateRanges, dimensions: [{ name: "customEvent:position" }], metrics: venueMetrics, dimensionFilter: outboundFilter, limit: 1000 })
        : Promise.resolve(null),
    ]);
    const impressionTotals = totals(impressionTotalsReport);
    const engagementTotals = totals(engagementTotalsReport);
    const actionTotals = totals(actionTotalsReport);
    const dimensionStatus = REQUESTED_VENUE_DIMENSIONS.map((apiName) => ({
      apiName,
      registered: availableDimensionNames.has(apiName),
    }));
    const impressionMissingId = missingCount(impressionQaReport, 0);
    const impressionMissingSlug = missingCount(impressionQaReport, 1);
    const impressionMissingName = missingCount(impressionQaReport, 2);
    const actionMissingId = missingCount(actionQaReport, 0);
    const actionMissingLinkType = missingCount(actionQaReport, 1);

    return json(200, {
      ok: true,
      startDate,
      endDate,
      source: { hostName: HOST_NAME, pagePath: GUIDE_PATH, label: "Ahangama Guide" },
      minimumActionRateImpressions: 100,
      totals: {
        eventCount: Number(report?.totals?.[0]?.metricValues?.[0]?.value || 0),
        users: Number(report?.totals?.[0]?.metricValues?.[1]?.value || 0),
      },
      venuePerformance: {
        totals: {
          impressions: impressionTotals.eventCount,
          usersExposed: impressionTotals.users,
          engagements: engagementTotals.eventCount,
          outboundActions: actionTotals.eventCount,
        },
        venues: buildVenueRows(
          impressionVenueReport,
          engagementVenueReport,
          engagementUsersReport,
          actionVenueReport,
        ),
        sections: buildBreakdown(sectionImpressionReport, sectionActionReport),
        components: buildBreakdown(
          componentImpressionReport,
          componentActionReport,
        ),
        positions: positionAvailable
          ? buildBreakdown(positionImpressionReport, positionActionReport)
          : null,
        timeSeries: buildTimeSeries(impressionTimeReport, actionTimeReport),
        qa: [
          { metric: "venue_impression missing venue_id", count: impressionMissingId, total: impressionTotals.eventCount },
          { metric: "venue_impression missing venue_slug", count: impressionMissingSlug, total: impressionTotals.eventCount },
          { metric: "venue_impression missing venue_name", count: impressionMissingName, total: impressionTotals.eventCount },
          { metric: "guide_outbound_click missing venue_id", count: actionMissingId, total: actionTotals.eventCount },
          { metric: "guide_outbound_click missing link_type", count: actionMissingLinkType, total: actionTotals.eventCount },
        ],
        dimensionStatus,
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
