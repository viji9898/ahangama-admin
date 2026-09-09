import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { getGaMetadata, runGaReport } from "./_lib/ga4QrAnalytics.mjs";
import {
  calculateArticleKpis,
  calculateDiscoveryRows,
  safeRate,
} from "./_lib/articleInsights.mjs";

const HOST_NAME = "ahangama.com";
const DEFAULT_CONTENT_ID =
  "the-mugatiya-a-heritage-villa-made-for-slower-days-in-ahangama";
const ARTICLE_EVENTS = [
  "article_view",
  "article_card_impression",
  "article_select",
  "article_engaged_read",
  "article_progress",
  "article_complete",
  "article_section_view",
  "article_outbound_click",
  "article_next_select",
];
const CUSTOM_DIMENSIONS = {
  contentId: "customEvent:content_id",
  contentTitle: "customEvent:content_title",
  articleCategory: "customEvent:article_category",
  authorName: "customEvent:author_name",
  componentLocation: "customEvent:component_location",
  articleSection: "customEvent:article_section",
  progressPercent: "customEvent:progress_percent",
  targetContentId: "customEvent:target_content_id",
  linkType: "customEvent:link_type",
  sourceDomain: "customEvent:source_domain",
  utmSource: "customEvent:utm_source",
  utmMedium: "customEvent:utm_medium",
  utmCampaign: "customEvent:utm_campaign",
  destinationUrl: "customEvent:destination_url",
};
const REQUIRED_DIMENSIONS = Object.values(CUSTOM_DIMENSIONS).slice(0, 9);
const ACTIVE_READ_METRIC = "customEvent:active_read_seconds";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  },
  body: JSON.stringify(body),
});

const clean = (value) => {
  const result = String(value || "").trim();
  return result === "(not set)" ? "" : result;
};

const metric = (row, index = 0) =>
  Number(row?.metricValues?.[index]?.value || 0);

const exactFilter = (fieldName, value) => ({
  filter: {
    fieldName,
    stringFilter: { matchType: "EXACT", value, caseSensitive: true },
  },
});

const eventFilter = (eventNames) => ({
  filter: {
    fieldName: "eventName",
    inListFilter: { values: eventNames, caseSensitive: true },
  },
});

function getDateRange(params) {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const startDate = clean(params.startDate);
  const endDate = clean(params.endDate);
  if (validDate(startDate) && validDate(endDate)) return { startDate, endDate };

  const days = new Set([7, 30, 90]).has(Number(params.days))
    ? Number(params.days)
    : 30;
  return { startDate: `${days}daysAgo`, endDate: "today" };
}

function rowsByHeader(report) {
  const headers = report?.dimensionHeaders || [];
  return (report?.rows || []).map((row) => ({
    ...Object.fromEntries(
      headers.map((header, index) => [header.name, clean(row.dimensionValues?.[index]?.value)]),
    ),
    eventCount: metric(row, 0),
    activeReadSeconds: metric(row, 1),
  }));
}

function reportDimensions(names, available) {
  return names.filter((name) => available.has(name)).map((name) => ({ name }));
}

function articleFilters(params, available, eventNames = ARTICLE_EVENTS) {
  const expressions = [exactFilter("hostName", HOST_NAME), eventFilter(eventNames)];
  const optional = [
    [CUSTOM_DIMENSIONS.contentId, clean(params.contentId)],
    [CUSTOM_DIMENSIONS.articleCategory, clean(params.category)],
    [CUSTOM_DIMENSIONS.utmSource, clean(params.trafficSource)],
    ["deviceCategory", clean(params.device)],
  ];
  for (const [fieldName, value] of optional) {
    if (value && value !== "all" && available.has(fieldName)) {
      expressions.push(exactFilter(fieldName, value));
    }
  }
  return { andGroup: { expressions } };
}

function optionList(rows, fieldName) {
  return [...new Set(rows.map((row) => row[fieldName]).filter(Boolean))].sort();
}

function safeDestination(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return clean(value).split(/[?#]/, 1)[0];
  }
}

function sumEvents(rows) {
  return rows.reduce((counts, row) => {
    counts[row.eventName] = (counts[row.eventName] || 0) + row.eventCount;
    return counts;
  }, {});
}

async function settleReports(reports, concurrency = 3) {
  const results = new Array(reports.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, reports.length) },
    async () => {
      while (nextIndex < reports.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = {
            status: "fulfilled",
            value: await reports[index].run(),
          };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    },
  );
  await Promise.all(workers);
  const warnings = [];
  const values = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;

    warnings.push({
      report: reports[index].label,
      message: String(result.reason?.message || result.reason),
    });
    return null;
  });

  return { values, warnings };
}

function summarizeQuota(reports, failedReports) {
  const quotas = reports.map((report) => report?.propertyQuota).filter(Boolean);
  const quota = (name) => quotas.map((item) => item[name]).filter(Boolean);
  const consumed = (name) =>
    quota(name).reduce((total, item) => total + Number(item.consumed || 0), 0);
  const remaining = (name) => {
    const values = quota(name).map((item) => Number(item.remaining));
    return values.length ? Math.min(...values) : null;
  };

  return {
    successfulReports: reports.filter(Boolean).length,
    failedReports,
    coreTokensConsumed: consumed("tokensPerProjectPerHour"),
    projectTokensRemainingThisHour: remaining("tokensPerProjectPerHour"),
    propertyTokensRemainingThisHour: remaining("tokensPerHour"),
    propertyTokensRemainingToday: remaining("tokensPerDay"),
    concurrentRequestsRemaining: remaining("concurrentRequests"),
    serverErrorsRemainingThisHour: remaining("serverErrorsPerProjectPerHour"),
  };
}

async function getArticleInsights(params) {
  const normalizedParams = {
    ...params,
    contentId: clean(params.contentId) || DEFAULT_CONTENT_ID,
  };
  const { startDate, endDate } = getDateRange(params);
  const metadata = await getGaMetadata();
  const available = new Set(
    (metadata?.dimensions || []).map(({ apiName }) => apiName),
  );
  const availableMetrics = new Set(
    (metadata?.metrics || []).map(({ apiName }) => apiName),
  );
  const dimensionStatus = REQUIRED_DIMENSIONS.map((apiName) => ({
    apiName,
    registered: available.has(apiName),
  }));
  const metricStatus = {
    apiName: ACTIVE_READ_METRIC,
    registered: availableMetrics.has(ACTIVE_READ_METRIC),
  };

  if (!available.has(CUSTOM_DIMENSIONS.contentId)) {
    return {
      available: false,
      error: "content_id is not registered as a GA4 event-scoped custom dimension.",
      dimensionStatus,
      metricStatus,
    };
  }

  const dateRanges = [{ startDate, endDate }];
  const catalogDimensions = reportDimensions(
    [
      CUSTOM_DIMENSIONS.contentId,
      CUSTOM_DIMENSIONS.contentTitle,
      CUSTOM_DIMENSIONS.articleCategory,
      CUSTOM_DIMENSIONS.authorName,
      CUSTOM_DIMENSIONS.utmSource,
      CUSTOM_DIMENSIONS.utmMedium,
      CUSTOM_DIMENSIONS.utmCampaign,
      "deviceCategory",
    ],
    available,
  );
  const selectedFilter = articleFilters(normalizedParams, available);
  const report = (dimensions, eventNames, metrics = [{ name: "eventCount" }]) =>
    runGaReport({
      dateRanges,
      dimensions: reportDimensions(dimensions, available),
      metrics,
      dimensionFilter: articleFilters(normalizedParams, available, eventNames),
      keepEmptyRows: false,
      limit: 10000,
      returnPropertyQuota: true,
    });
  const activeMetrics = [{ name: "eventCount" }];
  if (metricStatus.registered) activeMetrics.push({ name: ACTIVE_READ_METRIC });

  const { values, warnings } = await settleReports([
    {
      label: "article catalog",
      run: () => runGaReport({
        dateRanges,
        dimensions: catalogDimensions,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              exactFilter("hostName", HOST_NAME),
              eventFilter(["article_view"]),
            ],
          },
        },
        keepEmptyRows: false,
        limit: 10000,
        returnPropertyQuota: true,
      }),
    },
    {
      label: "article totals",
      run: () => runGaReport({
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: selectedFilter,
        keepEmptyRows: false,
        limit: 100,
        returnPropertyQuota: true,
      }),
    },
    { label: "active reading time", run: () => report([], ["article_engaged_read"], activeMetrics) },
    { label: "reading progress", run: () => report([CUSTOM_DIMENSIONS.progressPercent], ["article_progress"]) },
    { label: "section reach", run: () => report([CUSTOM_DIMENSIONS.articleSection, "pagePath"], ["article_section_view"]) },
    { label: "discovery performance", run: () => report([CUSTOM_DIMENSIONS.componentLocation, "eventName"], ["article_card_impression", "article_select"]) },
    {
      label: "traffic quality",
      run: () => report(
        [CUSTOM_DIMENSIONS.utmSource, CUSTOM_DIMENSIONS.utmMedium, CUSTOM_DIMENSIONS.utmCampaign, "eventName"],
        ["article_view", "article_engaged_read", "article_complete"],
        activeMetrics,
      ),
    },
    {
      label: "outbound intent",
      run: () => report(
        [CUSTOM_DIMENSIONS.articleSection, CUSTOM_DIMENSIONS.linkType, CUSTOM_DIMENSIONS.destinationUrl, CUSTOM_DIMENSIONS.sourceDomain],
        ["article_outbound_click"],
      ),
    },
    { label: "article continuation", run: () => report([CUSTOM_DIMENSIONS.targetContentId], ["article_next_select"]) },
  ]);
  const [
    catalogReport,
    totalsReport,
    activeReport,
    progressReport,
    sectionReport,
    discoveryReport,
    trafficReport,
    outboundReport,
    continuationReport,
  ] = values;

  const catalogRows = rowsByHeader(catalogReport);
  const totalRows = rowsByHeader(totalsReport);
  const activeSeconds = metric(activeReport?.rows?.[0], 1);
  const kpis = calculateArticleKpis(sumEvents(totalRows), metricStatus.registered ? activeSeconds : null);
  const progress = Object.fromEntries(
    rowsByHeader(progressReport).map((row) => [Number(row[CUSTOM_DIMENSIONS.progressPercent]), row.eventCount]),
  );
  const sections = rowsByHeader(sectionReport).map((row, index) => ({
    key: `${row[CUSTOM_DIMENSIONS.articleSection] || "unclassified"}:${index}`,
    articleSection: row[CUSTOM_DIMENSIONS.articleSection] || "unclassified",
    pagePath: row.pagePath || "",
    views: row.eventCount,
    engagedReaderReach: safeRate(row.eventCount, kpis.engagedReads),
  }));
  const traffic = new Map();
  for (const row of rowsByHeader(trafficReport)) {
    const key = [
      row[CUSTOM_DIMENSIONS.utmSource] || "(direct)",
      row[CUSTOM_DIMENSIONS.utmMedium] || "(none)",
      row[CUSTOM_DIMENSIONS.utmCampaign] || "(not set)",
    ].join("|");
    const item = traffic.get(key) || {
      key,
      utmSource: row[CUSTOM_DIMENSIONS.utmSource] || "(direct)",
      utmMedium: row[CUSTOM_DIMENSIONS.utmMedium] || "(none)",
      utmCampaign: row[CUSTOM_DIMENSIONS.utmCampaign] || "(not set)",
      views: 0,
      engagedReads: 0,
      completions: 0,
      activeReadSeconds: 0,
    };
    if (row.eventName === "article_view") item.views += row.eventCount;
    if (row.eventName === "article_engaged_read") {
      item.engagedReads += row.eventCount;
      item.activeReadSeconds += row.activeReadSeconds;
    }
    if (row.eventName === "article_complete") item.completions += row.eventCount;
    traffic.set(key, item);
  }
  const trafficQuality = [...traffic.values()].map((item) => ({
    ...item,
    qualifiedReadRate: safeRate(item.engagedReads, item.views),
    completionRate: safeRate(item.completions, item.engagedReads),
    averageActiveReadSeconds:
      item.engagedReads > 0 && metricStatus.registered
        ? item.activeReadSeconds / item.engagedReads
        : null,
  }));
  const outboundIntent = rowsByHeader(outboundReport).map((row, index) => ({
    key: index,
    articleSection: row[CUSTOM_DIMENSIONS.articleSection] || "unclassified",
    linkType: row[CUSTOM_DIMENSIONS.linkType] || "external",
    destinationUrl: safeDestination(row[CUSTOM_DIMENSIONS.destinationUrl]),
    sourceDomain: row[CUSTOM_DIMENSIONS.sourceDomain] || "",
    clicks: row.eventCount,
  }));
  const continuation = rowsByHeader(continuationReport)
    .map((row) => ({
      targetContentId: row[CUSTOM_DIMENSIONS.targetContentId] || "unclassified",
      selections: row.eventCount,
      continuationRate: safeRate(row.eventCount, kpis.completions),
    }))
    .sort((left, right) => right.selections - left.selections);
  const articles = new Map();
  for (const row of catalogRows) {
    const contentId = row[CUSTOM_DIMENSIONS.contentId];
    if (!contentId) continue;
    articles.set(contentId, {
      contentId,
      contentTitle: row[CUSTOM_DIMENSIONS.contentTitle] || contentId,
      articleCategory: row[CUSTOM_DIMENSIONS.articleCategory] || "unclassified",
    });
  }

  return {
    available: true,
    startDate,
    endDate,
    selectedContentId: normalizedParams.contentId,
    kpis,
    funnel: [
      { label: "Article view", value: kpis.views },
      { label: "Engaged read", value: kpis.engagedReads },
      { label: "25%", value: Number(progress[25] || 0) },
      { label: "50%", value: Number(progress[50] || 0) },
      { label: "75%", value: Number(progress[75] || 0) },
      { label: "Complete", value: kpis.completions },
    ],
    sections,
    discovery: calculateDiscoveryRows(
      rowsByHeader(discoveryReport).map((row) => ({
        componentLocation: row[CUSTOM_DIMENSIONS.componentLocation],
        eventName: row.eventName,
        eventCount: row.eventCount,
      })),
    ),
    trafficQuality: trafficQuality.sort((left, right) => right.views - left.views),
    outboundIntent: outboundIntent.sort((left, right) => right.clicks - left.clicks),
    continuation,
    filters: {
      articles: [...articles.values()].sort((left, right) => left.contentTitle.localeCompare(right.contentTitle)),
      categories: optionList(catalogRows, CUSTOM_DIMENSIONS.articleCategory),
      trafficSources: optionList(catalogRows, CUSTOM_DIMENSIONS.utmSource),
      devices: optionList(catalogRows, "deviceCategory"),
    },
    dimensionStatus,
    metricStatus,
    warnings,
    quota: summarizeQuota(values, warnings.length),
    limitations: [
      "Milestones use event counts because the browser tracker emits each milestone once per article render. GA4 cannot independently deduplicate duplicate client emissions by render ID.",
      "Section order follows GA4 report order because article_section has no numeric order parameter. Register a section_index event dimension to guarantee editorial order.",
      "Custom definitions can take 24–48 hours to populate and do not backfill historical events.",
    ],
  };
}

async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    requireAdmin(event);
    return json(200, { ok: true, ...(await getArticleInsights(event.queryStringParameters || {})) });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      available: false,
      error: String(error?.message || error),
    });
  }
}

export default modernHandler(handler);