import { getQrDashboardSummary, runGaReport } from "./_lib/ga4QrAnalytics.mjs";
import { query, queryFromEnv } from "./_lib/db.mjs";

const HOST_NAME = "ahangama.com";
const ALLOWED_DAYS = new Set([7, 30, 90]);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300, s-maxage=1800",
  },
  body: JSON.stringify(body),
});

function hostFilter() {
  return {
    filter: {
      fieldName: "hostName",
      stringFilter: { matchType: "EXACT", value: HOST_NAME },
    },
  };
}

function numberMetric(row, index) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function getMetaConfig() {
  const accessToken = String(process.env.META_SYSTEM_USER_ACCESS_TOKEN || "").trim();
  const accountId = String(process.env.META_INSTAGRAM_ACCOUNT_ID || "").trim();
  const rawVersion = String(process.env.META_GRAPH_API_VERSION || "v25.0").trim();
  const version = /^v\d+\.\d+$/.test(rawVersion)
    ? rawVersion
    : /^\d+\.\d+$/.test(rawVersion)
      ? `v${rawVersion}`
      : "v25.0";

  if (!accessToken || !accountId) {
    throw new Error("Instagram credentials are not configured");
  }

  return { accessToken, accountId, version };
}

async function fetchMeta(path, params = {}, tokenOverride = "") {
  const { accessToken, version } = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenOverride || accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Meta API request failed (${response.status})`);
  }

  return payload;
}

async function getInstagramStats(days) {
  const { accountId } = getMetaConfig();
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 24 * 60 * 60;
  const insightWindows = [];
  let windowUntil = until;

  while (windowUntil > since) {
    const windowSince = Math.max(since, windowUntil - 30 * 24 * 60 * 60);
    insightWindows.push({ since: windowSince, until: windowUntil });
    windowUntil = windowSince;
  }

  const [profile, insightReports, media] = await Promise.all([
    fetchMeta(accountId, {
      fields: "username,followers_count,media_count,profile_picture_url",
    }),
    Promise.all(
      insightWindows.map((range) =>
        fetchMeta(`${accountId}/insights`, {
          metric: "views,reach,accounts_engaged,total_interactions",
          period: "day",
          metric_type: "total_value",
          since: range.since,
          until: range.until,
        }),
      ),
    ),
    fetchMeta(`${accountId}/media`, {
      fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url",
      limit: 50,
    }),
  ]);
  const totals = insightReports
    .flatMap((report) => report?.data || [])
    .reduce((values, metric) => {
      values[metric.name] =
        (values[metric.name] || 0) +
        Number(metric?.total_value?.value ?? metric?.values?.[0]?.value ?? 0);
      return values;
    }, {});
  const rangeStart = since * 1000;
  const topContent = (media?.data || [])
    .filter((item) => new Date(item.timestamp).getTime() >= rangeStart)
    .map((item) => ({
      id: item.id,
      caption: String(item.caption || "Instagram post").trim().slice(0, 120),
      mediaType: item.media_type,
      permalink: item.permalink,
      imageUrl: item.thumbnail_url || item.media_url || "",
      likes: Number(item.like_count || 0),
      comments: Number(item.comments_count || 0),
    }))
    .sort(
      (left, right) =>
        right.likes + right.comments - (left.likes + left.comments),
    )
    .slice(0, 3);

  return {
    available: true,
    username: profile.username || "",
    profilePictureUrl: profile.profile_picture_url || "",
    followers: Number(profile.followers_count || 0),
    mediaCount: Number(profile.media_count || 0),
    views: totals.views || 0,
    reach: totals.reach || 0,
    accountsEngaged: totals.accounts_engaged || 0,
    interactions: totals.total_interactions || 0,
    topContent,
  };
}

function sumInsightValues(payload) {
  return (payload?.data?.[0]?.values || []).reduce(
    (total, item) => total + Number(item?.value || 0),
    0,
  );
}

function latestInsightValue(payload) {
  const values = payload?.data?.[0]?.values || [];
  return Number(values.at(-1)?.value || 0);
}

async function getFacebookStats(days) {
  const pageId = String(process.env.META_PAGE_ID || "").trim();
  if (!pageId) throw new Error("Facebook Page ID is not configured");

  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 24 * 60 * 60;
  const profile = await fetchMeta(pageId, {
    fields: "name,fan_count,link,picture,access_token",
  });
  const pageAccessToken = String(profile.access_token || "").trim();
  if (!pageAccessToken) throw new Error("Unable to acquire Facebook Page access");

  const metricResults = await Promise.all(
    [
      "page_media_view",
      "page_post_engagements",
      "page_views_total",
      "page_follows",
    ].map((metric) =>
      fetchMeta(`${pageId}/insights/${metric}`, {
        period: "day",
        since,
        until,
      }, pageAccessToken).catch(() => null),
    ),
  );

  return {
    available: true,
    name: profile.name || "Facebook Page",
    link: profile.link || "",
    pictureUrl: profile.picture?.data?.url || "",
    pageLikes: Number(profile.fan_count || 0),
    views: sumInsightValues(metricResults[0]),
    engagements: sumInsightValues(metricResults[1]),
    pageViews: sumInsightValues(metricResults[2]),
    followers: latestInsightValue(metricResults[3]),
  };
}

async function getWebsiteStats(startDate, endDate) {
  const base = {
    dateRanges: [{ startDate, endDate }],
    dimensionFilter: hostFilter(),
    keepEmptyRows: false,
  };

  const [totalsReport, pagesReport, sourcesReport, countriesReport, clicksReport] =
    await Promise.all([
      runGaReport({
        ...base,
        metrics: [
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "sessions" },
        ],
        limit: 1,
      }),
      runGaReport({
        ...base,
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 8,
      }),
      runGaReport({
        ...base,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 6,
      }),
      runGaReport({
        ...base,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 6,
      }),
      runGaReport({
        ...base,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              hostFilter(),
              {
                filter: {
                  fieldName: "eventName",
                  stringFilter: { matchType: "EXACT", value: "click" },
                },
              },
            ],
          },
        },
        limit: 1,
      }),
    ]);

  const totals = totalsReport?.rows?.[0];

  return {
    available: true,
    activeVisitors: numberMetric(totals, 0),
    pageViews: numberMetric(totals, 1),
    sessions: numberMetric(totals, 2),
    outboundClicks: numberMetric(clicksReport?.rows?.[0], 0),
    topPages: (pagesReport?.rows || []).map((row) => ({
      path: row.dimensionValues?.[0]?.value || "/",
      title: row.dimensionValues?.[1]?.value || "Untitled page",
      views: numberMetric(row, 0),
    })),
    trafficSources: (sourcesReport?.rows || []).map((row) => ({
      label: row.dimensionValues?.[0]?.value || "Other",
      value: numberMetric(row, 0),
    })),
    countries: (countriesReport?.rows || []).map((row) => ({
      label: row.dimensionValues?.[0]?.value || "Unknown",
      value: numberMetric(row, 0),
    })),
  };
}

async function countPasses() {
  const databaseEnv = "NETLIFY_DATABASE_URL";
  const tablesResult = await queryFromEnv(
    databaseEnv,
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [["purchases", "promo_purchases", "pass_guests", "hospo_pass_profiles"]],
  );
  const tables = new Set(tablesResult.rows.map((row) => row.table_name));
  const counts = await Promise.all([
    tables.has("purchases")
      ? queryFromEnv(databaseEnv, "SELECT COUNT(*)::int AS count FROM purchases WHERE status = 'paid'")
      : { rows: [{ count: 0 }] },
    tables.has("promo_purchases")
      ? queryFromEnv(databaseEnv, "SELECT COUNT(*)::int AS count FROM promo_purchases")
      : { rows: [{ count: 0 }] },
    tables.has("pass_guests")
      ? queryFromEnv(databaseEnv, "SELECT COUNT(*)::int AS count FROM pass_guests")
      : { rows: [{ count: 0 }] },
    tables.has("hospo_pass_profiles")
      ? queryFromEnv(databaseEnv, "SELECT COUNT(*)::int AS count FROM hospo_pass_profiles")
      : { rows: [{ count: 0 }] },
  ]);

  return counts.reduce((total, result) => total + Number(result.rows[0]?.count || 0), 0);
}

async function countVenues() {
  const result = await query(
    "SELECT COUNT(*)::int AS count FROM venues260414 WHERE deleted_at IS NULL AND live = TRUE",
  );
  return Number(result.rows[0]?.count || 0);
}

function summarizeQr(payload) {
  const grouped = new Map();

  for (const row of payload?.rows || []) {
    const venue = String(row.venue || "unknown");
    const existing = grouped.get(venue) || {
      venue,
      scans: 0,
      clicks: 0,
      purchases: 0,
      exposure: 0,
    };
    existing.scans += Number(row.sessions || 0);
    existing.clicks += Number(row.ctaClick || 0);
    existing.purchases += Number(row.purchases || 0);
    existing.exposure += Number(row.users || 0);
    grouped.set(venue, existing);
  }

  return {
    available: true,
    scans: [...grouped.values()].reduce((total, row) => total + row.scans, 0),
    clicks: Number(payload?.stats?.ctaClick || 0),
    purchases: Number(payload?.stats?.totalPurchases || 0),
    surfaces: Object.entries(
      (payload?.rows || []).reduce((totals, row) => {
        const surface = String(row.surface || "Other");
        totals[surface] = (totals[surface] || 0) + Number(row.sessions || 0);
        return totals;
      }, {}),
    )
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6),
    partners: [...grouped.values()]
      .sort((left, right) => right.scans - left.scans)
      .slice(0, 8),
  };
}

function unavailable(error) {
  return { available: false, error: String(error?.message || error) };
}

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const requestedDays = Number(event.queryStringParameters?.days || 30);
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 30;
  const startDate = `${days}daysAgo`;
  const endDate = "today";
  const [websiteResult, qrResult, passesResult, venuesResult, instagramResult, facebookResult] =
    await Promise.allSettled([
      getWebsiteStats(startDate, endDate),
      getQrDashboardSummary({ startDate, endDate }),
      countPasses(),
      countVenues(),
      getInstagramStats(days),
      getFacebookStats(days),
    ]);

  const website =
    websiteResult.status === "fulfilled"
      ? websiteResult.value
      : unavailable(websiteResult.reason);
  const qr =
    qrResult.status === "fulfilled"
      ? summarizeQr(qrResult.value)
      : unavailable(qrResult.reason);

  return json(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    days,
    website,
    qr,
    overview: {
      activeVisitors: website.activeVisitors || 0,
      pageViews: website.pageViews || 0,
      clicks: (website.outboundClicks || 0) + (qr.clicks || 0),
      passesIssued:
        passesResult.status === "fulfilled" ? passesResult.value : null,
      liveVenues:
        venuesResult.status === "fulfilled" ? venuesResult.value : null,
    },
    social:
      instagramResult.status === "fulfilled"
        ? instagramResult.value
        : {
            available: false,
            reason: String(instagramResult.reason?.message || "Instagram insights unavailable"),
          },
    facebook:
      facebookResult.status === "fulfilled"
        ? facebookResult.value
        : {
            available: false,
            reason: String(facebookResult.reason?.message || "Facebook insights unavailable"),
          },
    campaigns: { available: false, reason: "Ad accounts not connected" },
  });
}