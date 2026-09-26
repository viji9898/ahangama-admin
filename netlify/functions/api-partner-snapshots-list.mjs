import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  },
  body: JSON.stringify(body),
});

const number = (value) => Number(value || 0);

function toSnapshotDto(row) {
  const payload = row.payload || {};
  const articles = Array.isArray(payload.articles?.articles)
    ? payload.articles.articles
    : [];

  return {
    key: `${row.venue_id}-${row.snapshot_date}-${row.period_days}`,
    venueId: row.venue_id,
    partnerSlug: row.partner_slug,
    partnerName: payload.partner?.name || row.partner_slug,
    snapshotDate: row.snapshot_date,
    periodDays: row.period_days,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    guide: {
      available: payload.guide?.available === true,
      impressions: number(payload.guide?.venue?.impressions),
      usersExposed: number(payload.guide?.venue?.usersExposed),
      engagements: number(payload.guide?.venue?.engagements),
    },
    articles: {
      available: payload.articles?.available === true,
      count: articles.length,
      pageViews: articles.reduce(
        (total, article) => total + number(article.pageViews),
        0,
      ),
      visitors: articles.reduce(
        (total, article) => total + number(article.visitors),
        0,
      ),
      engagedReads: articles.reduce(
        (total, article) => total + number(article.engagedReads),
        0,
      ),
      placeClicks: articles.reduce(
        (total, article) => total + number(article.placeClicks),
        0,
      ),
    },
    social: {
      available: payload.social?.available === true,
      views: number(payload.social?.views),
      reach: number(payload.social?.reach),
      interactions: number(payload.social?.interactions),
      posts: Array.isArray(payload.social?.posts)
        ? payload.social.posts.length
        : 0,
    },
  };
}

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const result = await query(`
      SELECT
        venue_id,
        partner_slug,
        snapshot_date,
        period_days,
        payload,
        generated_at,
        created_at,
        updated_at
      FROM partner_stats_snapshots
      ORDER BY snapshot_date DESC, generated_at DESC, partner_slug, period_days
    `);

    return json(200, {
      ok: true,
      snapshots: result.rows.map(toSnapshotDto),
    });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export default modernHandler(handler);