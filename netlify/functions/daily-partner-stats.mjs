import { modernHandler } from "./_lib/modernHandler.mjs";
import {
  getPartnerArticleContentIds,
  PARTNER_STATS_PERIODS,
  savePartnerStatsSnapshot,
} from "./_lib/partnerStatsSnapshots.mjs";
import { getVenueFromApi } from "./_lib/venueApi.mjs";
import { collectPartnerStats } from "./api-public-stats.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function configuredPartners() {
  const configured = String(process.env.PARTNER_STATS_VENUES || "").split(",");
  return [
    ...new Set(
      ["patels-ahangama", "villa-mugatiya", ...configured]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

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

async function collectPartner(identifier) {
  const venue = await getVenueFromApi(identifier);
  if (!venue) throw new Error(`Venue not found in venues API: ${identifier}`);
  if (!venue.live) throw new Error(`Venue is not live: ${identifier}`);

  const contentIds = await getPartnerArticleContentIds(venue.id);
  const periods = await Promise.all(
    PARTNER_STATS_PERIODS.map((days) => collectPeriod(venue, contentIds, days)),
  );
  return { venueId: venue.id, slug: venue.slug, contentIds, periods };
}

async function handler() {
  try {
    const partners = [];
    for (const identifier of configuredPartners()) {
      partners.push(await collectPartner(identifier));
    }
    console.info("[daily-partner-stats] snapshots stored", { partners });
    return json(200, { ok: true, partners });
  } catch (error) {
    console.error("[daily-partner-stats] collection failed", {
      message: String(error?.message || error),
      stack: error?.stack || null,
    });
    return json(500, { ok: false, error: String(error?.message || error) });
  }
}

export default modernHandler(handler);