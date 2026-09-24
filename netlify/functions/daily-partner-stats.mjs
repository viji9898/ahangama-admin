import { modernHandler } from "./_lib/modernHandler.mjs";
import {
  claimNextPartnerStatsJob,
  completePartnerStatsJob,
  failPartnerStatsJob,
  getPartnerArticleContentIds,
  savePartnerStatsSnapshot,
} from "./_lib/partnerStatsSnapshots.mjs";
import { getVenueFromApi } from "./_lib/venueApi.mjs";
import { collectPartnerStats } from "./api-public-stats.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function collectPeriod(venue, contentIds, days) {
  const payload = await collectPartnerStats({ venue, contentIds, days });
  const hasAvailableSource = [payload.guide, payload.articles, payload.social].some(
    (source) => source?.available,
  );
  if (!hasAvailableSource) {
    throw new Error(`No analytics sources were available for ${venue.slug} (${days} days)`);
  }
  await savePartnerStatsSnapshot(payload);
  return { days, generatedAt: payload.generatedAt };
}

export async function runNextPartnerStatsJob() {
  const job = await claimNextPartnerStatsJob();
  if (!job) return null;

  try {
    const venue = await getVenueFromApi(job.venue_id);
    if (!venue) {
      throw new Error(`Venue not found in venues API: ${job.venue_id}`);
    }

    const contentIds = await getPartnerArticleContentIds(venue.id);
    const result = await collectPeriod(venue, contentIds, job.period_days);
    await completePartnerStatsJob(job);
    return {
      venueId: venue.id,
      slug: venue.slug,
      contentIds,
      ...result,
      attempts: job.attempts,
    };
  } catch (error) {
    await failPartnerStatsJob(job, error);
    throw error;
  }
}

async function handler() {
  try {
    const result = await runNextPartnerStatsJob();
    if (!result) {
      return json(200, { ok: true, idle: true });
    }

    console.info("[daily-partner-stats] snapshot stored", result);
    return json(200, { ok: true, result });
  } catch (error) {
    console.error("[daily-partner-stats] collection failed", {
      message: String(error?.message || error),
      stack: error?.stack || null,
    });
    return json(500, { ok: false, error: String(error?.message || error) });
  }
}

export default modernHandler(handler);