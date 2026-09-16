import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { getGaMetadata, runGaReport } from "./_lib/ga4QrAnalytics.mjs";
import {
  HOME_EVENTS,
  buildContentRows,
  buildKpis,
  buildSectionRows,
  classifyAnalyticsError,
  cleanDimension,
  normalizeFilters,
  normalizeKey,
  resolveDateRanges,
  safeRate,
} from "./_lib/homepageEngagement.mjs";

const HOST_NAME = "ahangama.com";
const HOME_PATH = "/";
const CACHE_TTL_MS = 60 * 60 * 1000;
const CUSTOM_DIMENSIONS = {
  homeSection: "customEvent:home_section",
  componentLocation: "customEvent:component_location",
  contentId: "customEvent:content_id",
  contentTitle: "customEvent:content_title",
  contentType: "customEvent:content_type",
  position: "customEvent:position",
  destinationUrl: "customEvent:destination_url",
  linkType: "customEvent:link_type",
  controlName: "customEvent:control_name",
  ctaLocation: "customEvent:cta_location",
  pageType: "customEvent:page_type",
};
const cache = new Map();

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  },
  body: JSON.stringify(body),
});

const exactFilter = (fieldName, value) => ({
  filter: {
    fieldName,
    stringFilter: { matchType: "EXACT", value, caseSensitive: true },
  },
});

const eventFilter = (values) => ({
  filter: {
    fieldName: "eventName",
    inListFilter: { values, caseSensitive: true },
  },
});

function homepageFilter(filters = {}, events = []) {
  const expressions = [
    exactFilter("hostName", HOST_NAME),
    exactFilter("pagePath", HOME_PATH),
  ];
  if (events.length) expressions.push(eventFilter(events));
  if (filters.device && filters.device !== "all") {
    expressions.push(exactFilter("deviceCategory", filters.device));
  }
  if (filters.channel && filters.channel !== "all") {
    expressions.push(
      exactFilter("sessionDefaultChannelGroup", filters.channel),
    );
  }
  return { andGroup: { expressions } };
}

function metric(row, index = 0) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function rowsByHeader(report) {
  const dimensions = report?.dimensionHeaders || [];
  const metrics = report?.metricHeaders || [];
  return (report?.rows || []).map((row) => ({
    ...Object.fromEntries(
      dimensions.map(({ name }, index) => [
        name,
        cleanDimension(row.dimensionValues?.[index]?.value),
      ]),
    ),
    ...Object.fromEntries(
      metrics.map(({ name }, index) => [name, metric(row, index)]),
    ),
  }));
}

function report({ range, filters, dimensions = [], metrics, events = [], limit = 10000 }) {
  return runGaReport({
    dateRanges: [range],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dimensionFilter: homepageFilter(filters, events),
    keepEmptyRows: false,
    limit,
    returnPropertyQuota: true,
  });
}

async function settleReports(definitions, concurrency = 4) {
  const results = new Array(definitions.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, definitions.length) },
    async () => {
      while (nextIndex < definitions.length) {
        const index = nextIndex++;
        try {
          results[index] = {
            status: "fulfilled",
            value: await definitions[index].run(),
          };
        } catch (error) {
          results[index] = { status: "rejected", reason: error };
        }
      }
    },
  );
  await Promise.all(workers);

  const warnings = [];
  const values = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const classified = classifyAnalyticsError(result.reason);
    warnings.push({ report: definitions[index].label, ...classified });
    return null;
  });
  return { values, warnings };
}

function valuesForKpis(totalsReport, eventReport, utilityReport) {
  const total = totalsReport?.rows?.[0];
  const events = rowsByHeader(eventReport);
  const utilityEvents = rowsByHeader(utilityReport);
  const usersFor = (eventName) =>
    events.find((row) => row.eventName === eventName)?.totalUsers || 0;
  const transportUsers = utilityEvents
    .filter((row) =>
      ["home_content_select", "home_control_select", "home_outbound_click"].includes(
        row.eventName,
      ) &&
      [row[CUSTOM_DIMENSIONS.homeSection], row[CUSTOM_DIMENSIONS.componentLocation]]
        .map(normalizeKey)
        .includes("transport"),
    )
    .reduce((maximum, row) => Math.max(maximum, row.totalUsers || 0), 0);

  return {
    users: metric(total, 0),
    sessions: metric(total, 1),
    views: metric(total, 2),
    engagedSessions: metric(total, 3),
    engagementDuration: metric(total, 4),
    passCtaUsers: usersFor("pass_cta_click"),
    newsletterUsers: usersFor("newsletter_signup_success"),
    transportUsers,
  };
}

function mapSectionRows(report) {
  return rowsByHeader(report).map((row) => ({
    section: row[CUSTOM_DIMENSIONS.homeSection],
    eventName: row.eventName,
    users: row.totalUsers,
    eventCount: row.eventCount,
  }));
}

function mapContentRows(report, catalogReport) {
  const catalog = new Map();
  for (const row of rowsByHeader(catalogReport)) {
    const contentId = row[CUSTOM_DIMENSIONS.contentId];
    if (!contentId) continue;
    const existing = catalog.get(contentId) || {};
    catalog.set(contentId, {
      contentTitle:
        existing.contentTitle || row[CUSTOM_DIMENSIONS.contentTitle],
      contentType: existing.contentType || row[CUSTOM_DIMENSIONS.contentType],
      destination:
        existing.destination ||
        safeDestination(row[CUSTOM_DIMENSIONS.destinationUrl]),
    });
  }

  return rowsByHeader(report).map((row) => {
    const contentId = row[CUSTOM_DIMENSIONS.contentId];
    const details = catalog.get(contentId) || {};
    return {
      eventName: row.eventName,
      contentId,
      contentTitle: details.contentTitle,
      contentType: details.contentType,
      section: row[CUSTOM_DIMENSIONS.homeSection],
      componentLocation: row[CUSTOM_DIMENSIONS.componentLocation],
      position: row[CUSTOM_DIMENSIONS.position],
      destination: details.destination,
      users: row.totalUsers,
      eventCount: row.eventCount,
    };
  });
}

function safeDestination(value) {
  const cleaned = cleanDimension(value);
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned);
    return `${url.origin}${url.pathname}`;
  } catch {
    return cleaned.split(/[?#]/, 1)[0];
  }
}

function buildTrend(report) {
  const grouped = new Map();
  for (const row of rowsByHeader(report)) {
    const date = row.date;
    const item = grouped.get(date) || {
      date,
      users: 0,
      engagedSessions: 0,
      contentSelections: 0,
      passCtaClicks: 0,
    };
    if (row.eventName === "page_view") {
      item.users = row.totalUsers || 0;
      item.engagedSessions = row.engagedSessions || 0;
    }
    if (["home_content_select", "article_select"].includes(row.eventName)) {
      item.contentSelections += row.eventCount || 0;
    }
    if (row.eventName === "pass_cta_click") {
      item.passCtaClicks += row.eventCount || 0;
    }
    grouped.set(date, item);
  }
  return [...grouped.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function buildPassRows(report, homepageUsers) {
  return rowsByHeader(report)
    .filter((row) => row.eventName === "pass_cta_click")
    .map((row) => ({
      location: row[CUSTOM_DIMENSIONS.ctaLocation] || "unclassified",
      users: row.totalUsers || 0,
      clicks: row.eventCount || 0,
      clickRate: safeRate(row.totalUsers, homepageUsers),
      purchases: null,
      purchaseStatus: "unavailable",
    }))
    .sort((left, right) => right.clicks - left.clicks);
}

function buildUtilityRows(report) {
  const grouped = new Map();
  const classify = (row) => {
    const section = normalizeKey(row[CUSTOM_DIMENSIONS.homeSection]);
    const component = normalizeKey(row[CUSTOM_DIMENSIONS.componentLocation]);
    const control = normalizeKey(row[CUSTOM_DIMENSIONS.controlName]);
    const linkType = normalizeKey(row[CUSTOM_DIMENSIONS.linkType]);
    if (row.eventName === "newsletter_signup_success") return ["newsletter", "Newsletter signup successes"];
    if (row.eventName === "pass_cta_click") return null;
    if (section === "transport" || component === "transport") {
      if (linkType === "whatsapp") return ["transport_whatsapp", "WhatsApp transport enquiries"];
      return ["transport_quote", "Transport quote selections"];
    }
    if (section === "wellness_classes" || component === "wellness_classes") return ["wellness", "Wellness schedule selections"];
    if (section === "whats_on" || component === "whats_on" || control.includes("event")) return ["events", "Event calendar selections"];
    if (["guide_sections", "categories"].includes(section) || ["guide_sections", "categories"].includes(component)) return ["guide", "Guide/category selections"];
    if (section === "around_town" || component === "around_town") return [`around_town:${linkType || "external"}`, `Around Town · ${linkType || "external"}`];
    return null;
  };

  for (const row of rowsByHeader(report)) {
    const classification = classify(row);
    if (!classification) continue;
    const [key, label] = classification;
    const item = grouped.get(key) || { key, label, users: 0, actions: 0 };
    item.users += row.totalUsers || 0;
    item.actions += row.eventCount || 0;
    grouped.set(key, item);
  }
  return [...grouped.values()].sort((left, right) => right.actions - left.actions);
}

function buildBreakdown(standardReport, eventReport, sectionReport) {
  const eventRows = rowsByHeader(eventReport);
  const sectionRows = rowsByHeader(sectionReport);
  const dimensionName = standardReport?.dimensionHeaders?.[0]?.name;
  return rowsByHeader(standardReport)
    .map((row) => {
      const key = row[dimensionName];
      const events = eventRows.filter((item) => item[dimensionName] === key);
      const sections = sectionRows.filter((item) => item[dimensionName] === key);
      const eventUsers = (eventName) =>
        events.find((item) => item.eventName === eventName)?.totalUsers || 0;
      const sectionUsers = sections
        .filter((item) => item.eventName === "home_section_view")
        .reduce((maximum, item) => Math.max(maximum, item.totalUsers || 0), 0);
      const impressionUsers = events
        .filter((item) => ["home_content_impression", "article_card_impression"].includes(item.eventName))
        .reduce((total, item) => total + (item.totalUsers || 0), 0);
      const selectingUsers = events
        .filter((item) => ["home_content_select", "article_select"].includes(item.eventName))
        .reduce((total, item) => total + (item.totalUsers || 0), 0);
      return {
        key,
        users: row.totalUsers || 0,
        sessions: row.sessions || 0,
        engagementRate: safeRate(row.engagedSessions, row.sessions),
        sectionReach: safeRate(sectionUsers, row.totalUsers),
        contentCtr: safeRate(selectingUsers, impressionUsers),
        passCtaRate: safeRate(eventUsers("pass_cta_click"), row.totalUsers),
        newsletterRate: safeRate(
          eventUsers("newsletter_signup_success"),
          row.totalUsers,
        ),
      };
    })
    .sort((left, right) => right.sessions - left.sessions);
}

function buildTrackingHealth({ healthReport, pathReport, available, warnings, range }) {
  const healthRows = rowsByHeader(healthReport);
  const lastEvents = HOME_EVENTS.map((eventName) => {
    const dates = healthRows
      .filter((row) => row.eventName === eventName)
      .map((row) => row.dateHourMinute)
      .filter(Boolean)
      .sort();
    return { eventName, lastReceived: dates.at(-1) || null };
  });
  const blankContentIds = healthRows
    .filter((row) =>
      ["home_content_impression", "home_content_select", "article_card_impression", "article_select"].includes(row.eventName) &&
      !row[CUSTOM_DIMENSIONS.contentId],
    )
    .reduce((total, row) => total + (row.eventCount || 0), 0);
  const blankSections = healthRows
    .filter((row) => row.eventName === "home_section_view" && !row[CUSTOM_DIMENSIONS.homeSection])
    .reduce((total, row) => total + (row.eventCount || 0), 0);
  const unexpectedPaths = rowsByHeader(pathReport)
    .filter((row) => row.pagePath && row.pagePath !== HOME_PATH)
    .map((row) => ({ path: row.pagePath, eventName: row.eventName, events: row.eventCount }))
    .sort((left, right) => right.events - left.events);

  return {
    lastEvents,
    missingDimensions: Object.values(CUSTOM_DIMENSIONS).filter(
      (name) => !available.has(name),
    ),
    blankContentIds,
    blankSections,
    unexpectedPaths,
    apiErrors: warnings,
    predatesRegistration: null,
    registrationNote:
      "The GA4 Data API does not expose custom-dimension registration dates, so this cannot be determined automatically.",
    selectedStartDate: range.startDate,
  };
}

async function getChannelOptions(range) {
  const response = await runGaReport({
    dateRanges: [range],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: homepageFilter(),
    keepEmptyRows: false,
    limit: 100,
  });
  return rowsByHeader(response)
    .map((row) => row.sessionDefaultChannelGroup)
    .filter(Boolean)
    .sort();
}

async function buildHomepageEngagement(params, { forceRefresh = false } = {}) {
  const ranges = resolveDateRanges(params);
  const metadata = await getGaMetadata({ forceRefresh });
  const available = new Set(
    (metadata?.dimensions || []).map(({ apiName }) => apiName),
  );
  const channels = await getChannelOptions(ranges.current);
  const filters = normalizeFilters(params, channels);
  const has = (dimension) => available.has(dimension);
  const optional = (dimensions) => dimensions.filter(has);
  const sectionDimensions = optional([CUSTOM_DIMENSIONS.homeSection]);
  const contentMetricDimensions = optional([
    CUSTOM_DIMENSIONS.contentId,
    CUSTOM_DIMENSIONS.homeSection,
    CUSTOM_DIMENSIONS.componentLocation,
    CUSTOM_DIMENSIONS.position,
  ]);
  const contentCatalogDimensions = optional([
    CUSTOM_DIMENSIONS.contentId,
    CUSTOM_DIMENSIONS.contentTitle,
    CUSTOM_DIMENSIONS.contentType,
    CUSTOM_DIMENSIONS.destinationUrl,
  ]);
  const utilityDimensions = optional([
    CUSTOM_DIMENSIONS.homeSection,
    CUSTOM_DIMENSIONS.componentLocation,
    CUSTOM_DIMENSIONS.linkType,
    CUSTOM_DIMENSIONS.controlName,
  ]);
  const commonEvents = [
    "page_view",
    "home_content_impression",
    "home_content_select",
    "article_card_impression",
    "article_select",
    "pass_cta_click",
    "newsletter_signup_success",
  ];
  const definitions = [
    ["current totals", ranges.current, [], ["totalUsers", "sessions", "screenPageViews", "engagedSessions", "userEngagementDuration"], []],
    ["previous totals", ranges.previous, [], ["totalUsers", "sessions", "screenPageViews", "engagedSessions", "userEngagementDuration"], []],
    ["current KPI events", ranges.current, ["eventName"], ["totalUsers", "eventCount"], HOME_EVENTS],
    ["previous KPI events", ranges.previous, ["eventName"], ["totalUsers", "eventCount"], HOME_EVENTS],
    ["previous utility engagement", ranges.previous, ["eventName", ...utilityDimensions], ["totalUsers", "eventCount"], HOME_EVENTS],
    ["daily trend", ranges.current, ["date", "eventName"], ["totalUsers", "engagedSessions", "eventCount"], ["page_view", "home_content_select", "article_select", "pass_cta_click"]],
    ["section reach", ranges.current, ["eventName", ...sectionDimensions], ["totalUsers", "eventCount"], ["home_section_view", "home_content_impression", "home_content_select", "article_card_impression", "article_select"]],
    ["content performance", ranges.current, ["eventName", ...contentMetricDimensions], ["totalUsers", "eventCount"], ["home_content_impression", "home_content_select", "article_card_impression", "article_select"]],
    ["content catalog", ranges.current, contentCatalogDimensions, ["eventCount"], ["home_content_impression", "home_content_select", "article_card_impression", "article_select"]],
    ["previous content performance", ranges.previous, ["eventName", ...contentMetricDimensions], ["totalUsers", "eventCount"], ["home_content_impression", "home_content_select", "article_card_impression", "article_select"]],
    ["previous content catalog", ranges.previous, contentCatalogDimensions, ["eventCount"], ["home_content_impression", "home_content_select", "article_card_impression", "article_select"]],
    ["Pass CTA", ranges.current, ["eventName", ...optional([CUSTOM_DIMENSIONS.ctaLocation])], ["totalUsers", "eventCount"], ["pass_cta_click"]],
    ["utility engagement", ranges.current, ["eventName", ...utilityDimensions], ["totalUsers", "eventCount"], HOME_EVENTS],
    ["device totals", ranges.current, ["deviceCategory"], ["totalUsers", "sessions", "engagedSessions"], []],
    ["device events", ranges.current, ["deviceCategory", "eventName"], ["totalUsers"], commonEvents],
    ["device sections", ranges.current, ["deviceCategory", "eventName", ...sectionDimensions], ["totalUsers"], ["home_section_view"]],
    ["channel totals", ranges.current, ["sessionDefaultChannelGroup"], ["totalUsers", "sessions", "engagedSessions"], []],
    ["channel events", ranges.current, ["sessionDefaultChannelGroup", "eventName"], ["totalUsers"], commonEvents],
    ["channel sections", ranges.current, ["sessionDefaultChannelGroup", "eventName", ...sectionDimensions], ["totalUsers"], ["home_section_view"]],
  ].map(([label, range, dimensions, metrics, events]) => ({
    label,
    run: () => report({ range, filters, dimensions, metrics, events }),
  }));

  const healthDimensions = optional([
    CUSTOM_DIMENSIONS.contentId,
    CUSTOM_DIMENSIONS.homeSection,
  ]);
  definitions.push(
    {
      label: "tracking health",
      run: () =>
        report({
          range: ranges.current,
          filters,
          dimensions: ["dateHourMinute", "eventName", ...healthDimensions],
          metrics: ["eventCount"],
          events: HOME_EVENTS,
        }),
    },
    {
      label: "unexpected paths",
      run: () =>
        runGaReport({
          dateRanges: [ranges.current],
          dimensions: [{ name: "pagePath" }, { name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                exactFilter("hostName", HOST_NAME),
                eventFilter(HOME_EVENTS.filter((name) => name !== "page_view")),
              ],
            },
          },
          keepEmptyRows: false,
          limit: 1000,
        }),
    },
  );

  const { values, warnings } = await settleReports(definitions);
  const [
    currentTotals,
    previousTotals,
    currentEvents,
    previousEvents,
    previousUtilityReport,
    trendReport,
    sectionReport,
    contentReport,
    contentCatalogReport,
    previousContentReport,
    previousContentCatalogReport,
    passReport,
    utilityReport,
    deviceTotals,
    deviceEvents,
    deviceSections,
    channelTotals,
    channelEvents,
    channelSections,
    healthReport,
    pathReport,
  ] = values;
  if (!currentTotals) {
    throw new Error(warnings[0]?.message || "Homepage totals are unavailable");
  }

  const currentValues = valuesForKpis(
    currentTotals,
    currentEvents,
    utilityReport,
  );
  const previousValues = valuesForKpis(
    previousTotals,
    previousEvents,
    previousUtilityReport,
  );
  const kpis = buildKpis(currentValues, previousValues);
  const sectionRows = buildSectionRows(
    mapSectionRows(sectionReport),
    currentValues.users,
  );
  const content = buildContentRows(
    mapContentRows(contentReport, contentCatalogReport),
    mapContentRows(previousContentReport, previousContentCatalogReport),
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    scope: { hostName: HOST_NAME, pagePath: HOME_PATH },
    ranges,
    filters: { ...filters, channels },
    kpis,
    trend: buildTrend(trendReport),
    sections: sectionRows,
    content,
    passConversion: {
      rows: buildPassRows(passReport, currentValues.users),
      purchasesAvailable: false,
      purchaseNote:
        "Purchases are unavailable because reliable homepage and cross-domain attribution is not established.",
    },
    utility: buildUtilityRows(utilityReport),
    breakdowns: {
      devices: buildBreakdown(deviceTotals, deviceEvents, deviceSections),
      channels: buildBreakdown(channelTotals, channelEvents, channelSections),
    },
    diagnostics: buildTrackingHealth({
      healthReport,
      pathReport,
      available,
      warnings,
      range: ranges.current,
    }),
    dimensionStatus: Object.values(CUSTOM_DIMENSIONS).map((apiName) => ({
      apiName,
      registered: available.has(apiName),
    })),
    warnings,
  };
}

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }
    requireAdmin(event);
    const requestParams = event.queryStringParameters || {};
    const forceRefresh = Boolean(requestParams.refresh);
    const { refresh: _refresh, ...params } = requestParams;
    const cacheKey = JSON.stringify(params);
    const cached = cache.get(cacheKey);
    if (!forceRefresh && cached?.expiresAt > Date.now()) {
      return json(200, cached.payload);
    }

    const payload = await buildHomepageEngagement(params, { forceRefresh });
    cache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return json(200, payload);
  } catch (error) {
    const statusCode = error?.statusCode || (/date|days|device|channel/i.test(error?.message || "") ? 400 : 500);
    return json(statusCode, {
      ok: false,
      error: classifyAnalyticsError(error),
    });
  }
}

export { buildHomepageEngagement };
export default modernHandler(handler);
