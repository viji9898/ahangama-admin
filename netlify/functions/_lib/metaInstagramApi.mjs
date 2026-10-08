const MEDIA_INSIGHT_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
];

const ACCOUNT_TOTAL_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "profile_views",
  "website_clicks",
  "profile_links_taps",
];

const STORY_INSIGHT_METRICS = [
  "views",
  "reach",
  "replies",
  "shares",
  "total_interactions",
  "profile_activity",
  "navigation",
];

export function getMetaInstagramConfig() {
  const accessToken = String(
    process.env.META_SYSTEM_USER_ACCESS_TOKEN || "",
  ).trim();
  const accountId = String(process.env.META_INSTAGRAM_ACCOUNT_ID || "").trim();
  const rawVersion = String(
    process.env.META_GRAPH_API_VERSION || "v25.0",
  ).trim();
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

export async function fetchInstagramGraph(pathOrUrl, params = {}) {
  const { accessToken, version } = getMetaInstagramConfig();
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`https://graph.facebook.com/${version}/${pathOrUrl}`);

  url.searchParams.delete("access_token");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `Meta Instagram API request failed (${response.status})`,
    );
  }
  return payload;
}

export function insightValue(insights, name, fallback = 0) {
  const metric = (insights?.data || []).find((item) => item.name === name);
  return Number(metric?.values?.at(-1)?.value ?? fallback ?? 0);
}

export function captionMentions(caption) {
  return Array.from(
    new Set(
      [...String(caption || "").matchAll(/@([a-z0-9._]+)/gi)].map(
        (match) => `@${match[1].toLowerCase()}`,
      ),
    ),
  );
}

export function collaboratorHandles(collaborators) {
  return Array.from(
    new Set(
      (collaborators?.data || [])
        .filter(
          (collaborator) =>
            !collaborator.invite_status ||
            collaborator.invite_status === "Accepted",
        )
        .map((collaborator) =>
          collaborator.username
            ? `@${String(collaborator.username).toLowerCase()}`
            : "",
        )
        .filter(Boolean),
    ),
  );
}

export function parseFollowBreakdown(payload) {
  const results =
    payload?.data?.[0]?.total_value?.breakdowns?.flatMap(
      (breakdown) => breakdown.results || [],
    ) || [];
  return results.reduce(
    (totals, item) => {
      const type = String(item.dimension_values?.[0] || "").toUpperCase();
      if (type === "FOLLOWER") totals.follows += Number(item.value || 0);
      if (type === "NON_FOLLOWER") totals.unfollows += Number(item.value || 0);
      return totals;
    },
    { follows: 0, unfollows: 0 },
  );
}

async function fetchAll(path, params) {
  const items = [];
  let nextPath = path;
  let nextParams = params;
  while (nextPath) {
    const page = await fetchInstagramGraph(nextPath, nextParams);
    items.push(...(page?.data || []));
    nextPath = page?.paging?.next || "";
    nextParams = {};
  }
  return items;
}

export async function getInstagramProfile() {
  const { accountId } = getMetaInstagramConfig();
  return fetchInstagramGraph(accountId, {
    fields: "username,followers_count,media_count,profile_picture_url",
  });
}

export async function getInstagramMedia() {
  const { accountId } = getMetaInstagramConfig();
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_product_type",
    "permalink",
    "timestamp",
    "like_count",
    "comments_count",
    "thumbnail_url",
    "media_url",
    "username",
    "collaborators{username,invite_status}",
    `insights.metric(${MEDIA_INSIGHT_METRICS.join(",")}){name,values}`,
  ].join(",");
  const media = await fetchAll(`${accountId}/media`, { fields, limit: 100 });

  return media.map((item) => {
    const mentions = captionMentions(item.caption);
    const collaborators = collaboratorHandles(item.collaborators);
    const likes = insightValue(item.insights, "likes", item.like_count);
    const comments = insightValue(
      item.insights,
      "comments",
      item.comments_count,
    );
    const shares = insightValue(item.insights, "shares");
    const saved = insightValue(item.insights, "saved");
    return {
      id: item.id,
      caption: String(item.caption || ""),
      mediaType: item.media_type || "",
      mediaProductType: item.media_product_type || "",
      permalink: item.permalink || "",
      timestamp: item.timestamp || "",
      imageUrl: item.thumbnail_url || item.media_url || "",
      views: insightValue(item.insights, "views"),
      reach: insightValue(item.insights, "reach"),
      likes,
      comments,
      shares,
      saved,
      interactions: insightValue(
        item.insights,
        "total_interactions",
        likes + comments + shares + saved,
      ),
      mentions,
      collaborators,
      handles: Array.from(new Set([...mentions, ...collaborators])),
    };
  });
}

async function periodWindows(start, end, run) {
  const values = [];
  let windowStart = start;
  while (windowStart < end) {
    const windowEnd = Math.min(windowStart + 30 * 24 * 60 * 60 * 1000, end);
    values.push(await run(windowStart, windowEnd));
    windowStart = windowEnd;
  }
  return values;
}

export async function getInstagramAccountTotals(start, end) {
  const { accountId } = getMetaInstagramConfig();
  const totals = Object.fromEntries(
    ACCOUNT_TOTAL_METRICS.map((metric) => [metric, 0]),
  );
  const available = {};
  const reports = await periodWindows(start, end, (since, until) =>
    Promise.allSettled(
      ACCOUNT_TOTAL_METRICS.map((metric) =>
        fetchInstagramGraph(`${accountId}/insights`, {
          metric,
          period: "day",
          metric_type: "total_value",
          since: Math.floor(since / 1000),
          until: Math.floor(until / 1000),
        }).then((payload) => ({ metric, payload })),
      ),
    ),
  );
  for (const result of reports.flat()) {
    if (result.status !== "fulfilled") continue;
    const { metric, payload } = result.value;
    available[metric] = true;
    totals[metric] += Number(payload?.data?.[0]?.total_value?.value || 0);
  }

  const followReports = await periodWindows(start, end, (since, until) =>
    fetchInstagramGraph(`${accountId}/insights`, {
      metric: "follows_and_unfollows",
      period: "day",
      metric_type: "total_value",
      breakdown: "follow_type",
      since: Math.floor(since / 1000),
      until: Math.floor(until / 1000),
    }),
  );
  const followTotals = followReports.reduce(
    (totalsValue, payload) => {
      const values = parseFollowBreakdown(payload);
      totalsValue.follows += values.follows;
      totalsValue.unfollows += values.unfollows;
      return totalsValue;
    },
    { follows: 0, unfollows: 0 },
  );

  return { ...totals, ...followTotals, available };
}

export async function getInstagramDailyInsights(start, end) {
  const { accountId } = getMetaInstagramConfig();
  const requests = await periodWindows(start, end, (since, until) =>
    Promise.allSettled(
      ["reach", "follower_count"].map((metric) =>
        fetchInstagramGraph(`${accountId}/insights`, {
          metric,
          period: "day",
          ...(metric === "reach" ? { metric_type: "time_series" } : {}),
          since: Math.floor(since / 1000),
          until: Math.floor(until / 1000),
        }),
      ),
    ),
  );
  return requests
    .flat()
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
}

export async function getInstagramActiveStories() {
  const { accountId } = getMetaInstagramConfig();
  const fields = [
    "id",
    "caption",
    "media_type",
    "permalink",
    "timestamp",
    "thumbnail_url",
    "media_url",
    `insights.metric(${STORY_INSIGHT_METRICS.join(",")}){name,values}`,
  ].join(",");
  const stories = await fetchAll(`${accountId}/stories`, { fields, limit: 100 });
  return stories.map((item) => ({
    id: item.id,
    caption: String(item.caption || ""),
    mediaType: item.media_type || "",
    permalink: item.permalink || "",
    timestamp: item.timestamp || "",
    imageUrl: item.thumbnail_url || item.media_url || "",
    views: insightValue(item.insights, "views"),
    reach: insightValue(item.insights, "reach"),
    replies: insightValue(item.insights, "replies"),
    shares: insightValue(item.insights, "shares"),
    interactions: insightValue(item.insights, "total_interactions"),
    profileActivity: insightValue(item.insights, "profile_activity"),
    navigation: insightValue(item.insights, "navigation"),
  }));
}

export function getInstagramPaidAvailability() {
  const adAccountId = String(process.env.META_AD_ACCOUNT_ID || "").trim();
  return adAccountId
    ? { available: false, reason: "Paid post attribution is not implemented" }
    : {
        available: false,
        reason: "Set META_AD_ACCOUNT_ID and grant ads_read to enable paid attribution",
      };
}