import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import {
  getInstagramAccountTotals,
  getInstagramActiveStories,
  getInstagramDailyInsights,
  getInstagramMedia,
  getInstagramPaidAvailability,
  getInstagramProfile,
} from "./_lib/metaInstagramApi.mjs";
import {
  buildInstagramReport,
  instagramReportWindow,
  normalizeInstagramReportDays,
  normalizeInstagramTimeSeries,
} from "./_lib/instagramStats.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=300",
  },
  body: JSON.stringify(body),
});

function accountMetrics(totals) {
  return {
    views: totals.views,
    reach: totals.reach,
    accountsEngaged: totals.accounts_engaged,
    interactions: totals.total_interactions,
    profileViews: totals.profile_views,
    websiteClicks: totals.website_clicks,
    profileLinkTaps: totals.profile_links_taps,
    follows: totals.follows,
    unfollows: totals.unfollows,
    available: totals.available,
  };
}

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const days = normalizeInstagramReportDays(event.queryStringParameters?.days);
    const now = Date.now();
    const window = instagramReportWindow(days, now);
    const [
      profile,
      posts,
      currentTotals,
      previousTotals,
      currentDaily,
      previousDaily,
      storiesResult,
    ] = await Promise.all([
      getInstagramProfile(),
      getInstagramMedia(),
      getInstagramAccountTotals(window.currentStart, window.currentEnd),
      getInstagramAccountTotals(window.previousStart, window.previousEnd),
      getInstagramDailyInsights(window.currentStart, window.currentEnd),
      getInstagramDailyInsights(window.previousStart, window.previousEnd),
      getInstagramActiveStories().then(
        (stories) => ({ available: true, stories }),
        (error) => ({
          available: false,
          stories: [],
          reason: String(error?.message || error),
        }),
      ),
    ]);

    return json(200, {
      ok: true,
      generatedAt: new Date(now).toISOString(),
      username: profile.username || posts[0]?.username || "ahangama.pass",
      profile: {
        followers: Number(profile.followers_count || 0),
        mediaCount: Number(profile.media_count || 0),
        pictureUrl: profile.profile_picture_url || "",
      },
      account: accountMetrics(currentTotals),
      previousAccount: accountMetrics(previousTotals),
      timeSeries: normalizeInstagramTimeSeries(
        currentDaily,
        window.currentStart,
        window.currentEnd,
      ),
      previousTimeSeries: normalizeInstagramTimeSeries(
        previousDaily,
        window.previousStart,
        window.previousEnd,
      ),
      stories: storiesResult,
      paid: getInstagramPaidAvailability(),
      report: buildInstagramReport(posts, days, now),
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

export { accountMetrics };
export default modernHandler(handler);