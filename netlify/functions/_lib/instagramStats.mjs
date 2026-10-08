export const INSTAGRAM_REPORT_DAYS = new Set([7, 30, 90]);

export function normalizeInstagramReportDays(value) {
  const days = Number(value);
  return INSTAGRAM_REPORT_DAYS.has(days) ? days : 30;
}

export function instagramReportWindow(days, now = Date.now()) {
  const duration = days * 24 * 60 * 60 * 1000;
  return {
    currentStart: now - duration,
    currentEnd: now,
    previousStart: now - duration * 2,
    previousEnd: now - duration,
  };
}

export function summarizeInstagramPosts(posts) {
  const totals = posts.reduce(
    (result, post) => {
      result.views += Number(post.views || 0);
      result.reach += Number(post.reach || 0);
      result.likes += Number(post.likes || 0);
      result.comments += Number(post.comments || 0);
      result.shares += Number(post.shares || 0);
      result.saved += Number(post.saved || 0);
      result.interactions += Number(post.interactions || 0);
      return result;
    },
    {
      posts: posts.length,
      views: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saved: 0,
      interactions: 0,
    },
  );

  return {
    ...totals,
    interactionRate:
      totals.reach > 0 ? (totals.interactions / totals.reach) * 100 : 0,
  };
}

export function normalizeInstagramTimeSeries(reports, start, end) {
  const dates = new Map();
  for (
    let timestamp = new Date(start).setUTCHours(0, 0, 0, 0);
    timestamp < end;
    timestamp += 24 * 60 * 60 * 1000
  ) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
    dates.set(date, {
      date,
      views: 0,
      reach: 0,
      interactions: 0,
      follows: 0,
    });
  }

  for (const report of reports) {
    for (const metric of report?.data || []) {
      const field =
        metric.name === "total_interactions"
          ? "interactions"
          : metric.name === "follower_count"
            ? "follows"
            : metric.name;
      if (!new Set(["views", "reach", "interactions", "follows"]).has(field))
        continue;
      for (const item of metric.values || []) {
        const date = String(item.end_time || "").slice(0, 10);
        if (!dates.has(date)) continue;
        dates.get(date)[field] += Number(item.value || 0);
      }
    }
  }

  return [...dates.values()];
}

function scopePosts(posts, start, end) {
  return posts.filter((post) => {
    const timestamp = Date.parse(post.timestamp);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
  });
}

export function buildInstagramReport(posts, days, now = Date.now()) {
  const window = instagramReportWindow(days, now);
  const currentPosts = scopePosts(
    posts,
    window.currentStart,
    window.currentEnd + 1,
  );
  const previousPosts = scopePosts(
    posts,
    window.previousStart,
    window.previousEnd,
  );
  const formats = [...currentPosts.reduce((items, post) => {
    const format = post.mediaProductType || post.mediaType || "POST";
    const item = items.get(format) || {
      format,
      posts: 0,
      views: 0,
      reach: 0,
      interactions: 0,
    };
    item.posts += 1;
    item.views += Number(post.views || 0);
    item.reach += Number(post.reach || 0);
    item.interactions += Number(post.interactions || 0);
    items.set(format, item);
    return items;
  }, new Map()).values()].sort(
    (left, right) => right.interactions - left.interactions,
  );

  return {
    days,
    range: {
      start: new Date(window.currentStart).toISOString(),
      end: new Date(window.currentEnd).toISOString(),
      previousStart: new Date(window.previousStart).toISOString(),
      previousEnd: new Date(window.previousEnd).toISOString(),
    },
    totals: summarizeInstagramPosts(currentPosts),
    previousTotals: summarizeInstagramPosts(previousPosts),
    formats,
    posts: currentPosts.sort((left, right) =>
      right.timestamp.localeCompare(left.timestamp),
    ),
  };
}