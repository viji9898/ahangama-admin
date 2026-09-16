import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";

const INSIGHT_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
];

const MEDIA_FIELDS = [
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
  `insights.metric(${INSIGHT_METRICS.join(",")}){name,values}`,
].join(",");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=300",
  },
  body: JSON.stringify(body),
});

function getMetaConfig() {
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

async function fetchMeta(pathOrUrl, params = {}) {
  const { accessToken, version } = getMetaConfig();
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
      payload?.error?.message || `Meta API request failed (${response.status})`,
    );
  }

  return payload;
}

function insightValue(insights, name, fallback = 0) {
  const metric = (insights?.data || []).find((item) => item.name === name);
  return Number(metric?.values?.at(-1)?.value ?? fallback ?? 0);
}

function captionMentions(caption) {
  return Array.from(
    new Set(
      [...String(caption || "").matchAll(/@([a-z0-9._]+)/gi)].map(
        (match) => `@${match[1].toLowerCase()}`,
      ),
    ),
  );
}

function collaboratorHandles(collaborators) {
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

async function getAllMedia(accountId) {
  const media = [];
  let path = `${accountId}/media`;
  let params = { fields: MEDIA_FIELDS, limit: 100 };

  while (path) {
    const page = await fetchMeta(path, params);
    media.push(...(page?.data || []));
    path = page?.paging?.next || "";
    params = {};
  }

  return media;
}

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const { accountId } = getMetaConfig();
    const media = await getAllMedia(accountId);
    const posts = media
      .map((item) => {
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
      })
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));

    return json(200, {
      ok: true,
      username: media[0]?.username || "ahangama.pass",
      posts,
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export { captionMentions, collaboratorHandles, insightValue };
export default modernHandler(handler);