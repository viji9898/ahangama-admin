import { query } from "./db.mjs";

export const PARTNER_STATS_PERIODS = [7, 30, 90, 180, 365];

export async function getPartnerArticleContentIds(venueId) {
  const result = await query(
    `
      SELECT content_id
      FROM partner_article_mappings
      WHERE venue_id = $1 AND active = TRUE
      ORDER BY content_id
    `,
    [venueId],
  );
  return result.rows.map((row) => row.content_id);
}

export async function savePartnerStatsSnapshot(payload) {
  await query(
    `
      INSERT INTO partner_stats_snapshots (
        venue_id,
        partner_slug,
        snapshot_date,
        period_days,
        payload,
        generated_at
      )
      VALUES ($1, $2, CURRENT_DATE, $3, $4::jsonb, $5::timestamptz)
      ON CONFLICT (venue_id, snapshot_date, period_days) DO UPDATE SET
        partner_slug = EXCLUDED.partner_slug,
        payload = EXCLUDED.payload,
        generated_at = EXCLUDED.generated_at,
        updated_at = NOW()
    `,
    [
      payload.partner.id,
      payload.partner.slug,
      payload.days,
      JSON.stringify(payload),
      payload.generatedAt,
    ],
  );
}

export async function getLatestPartnerStatsSnapshot(partnerSlug, days) {
  const result = await query(
    `
      SELECT payload, snapshot_date, generated_at
      FROM partner_stats_snapshots
      WHERE lower(partner_slug) = lower($1) AND period_days = $2
      ORDER BY snapshot_date DESC, generated_at DESC
      LIMIT 1
    `,
    [partnerSlug, days],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    ...row.payload,
    snapshotDate: row.snapshot_date,
    snapshotAt:
      row.generated_at instanceof Date
        ? row.generated_at.toISOString()
        : row.generated_at,
  };
}