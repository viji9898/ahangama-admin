import { query } from "./db.mjs";

export const PARTNER_STATS_PERIODS = [7, 30, 90, 180, 365];

export async function claimNextPartnerStatsJob(
  periods = PARTNER_STATS_PERIODS,
) {
  const result = await query(
    `
      WITH candidate AS (
        SELECT
          config.venue_id,
          CURRENT_DATE AS snapshot_date,
          period.period_days
        FROM partner_stats_config AS config
        CROSS JOIN UNNEST($1::integer[]) WITH ORDINALITY
          AS period(period_days, period_order)
        LEFT JOIN partner_stats_snapshots AS snapshot
          ON snapshot.venue_id = config.venue_id
          AND snapshot.snapshot_date = CURRENT_DATE
          AND snapshot.period_days = period.period_days
        LEFT JOIN partner_stats_collection_jobs AS job
          ON job.venue_id = config.venue_id
          AND job.snapshot_date = CURRENT_DATE
          AND job.period_days = period.period_days
        WHERE config.enabled = TRUE
          AND snapshot.venue_id IS NULL
          AND (
            job.venue_id IS NULL
            OR (job.status = 'running' AND job.lease_expires_at <= NOW())
            OR (job.status = 'failed' AND job.next_attempt_at <= NOW())
            OR job.status = 'completed'
          )
        ORDER BY
          COALESCE(job.attempts, 0),
          period.period_order,
          config.sort_order,
          config.venue_id
        LIMIT 1
      )
      INSERT INTO partner_stats_collection_jobs (
        venue_id,
        snapshot_date,
        period_days,
        status,
        attempts,
        lease_expires_at,
        next_attempt_at,
        last_error,
        started_at,
        completed_at,
        updated_at
      )
      SELECT
        venue_id,
        snapshot_date,
        period_days,
        'running',
        1,
        NOW() + INTERVAL '8 minutes',
        NULL,
        NULL,
        NOW(),
        NULL,
        NOW()
      FROM candidate
      ON CONFLICT (venue_id, snapshot_date, period_days) DO UPDATE SET
        status = 'running',
        attempts = partner_stats_collection_jobs.attempts + 1,
        lease_expires_at = NOW() + INTERVAL '8 minutes',
        next_attempt_at = NULL,
        last_error = NULL,
        started_at = NOW(),
        completed_at = NULL,
        updated_at = NOW()
      WHERE
        (
          partner_stats_collection_jobs.status = 'running'
          AND partner_stats_collection_jobs.lease_expires_at <= NOW()
        )
        OR (
          partner_stats_collection_jobs.status = 'failed'
          AND partner_stats_collection_jobs.next_attempt_at <= NOW()
        )
        OR partner_stats_collection_jobs.status = 'completed'
      RETURNING venue_id, period_days, attempts
    `,
    [periods],
  );

  return result.rows[0] || null;
}

export async function completePartnerStatsJob(job) {
  await query(
    `
      UPDATE partner_stats_collection_jobs
      SET
        status = 'completed',
        lease_expires_at = NULL,
        next_attempt_at = NULL,
        last_error = NULL,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE venue_id = $1
        AND snapshot_date = CURRENT_DATE
        AND period_days = $2
    `,
    [job.venue_id, job.period_days],
  );
}

export async function failPartnerStatsJob(job, error) {
  await query(
    `
      UPDATE partner_stats_collection_jobs
      SET
        status = 'failed',
        lease_expires_at = NULL,
        next_attempt_at = NOW() + INTERVAL '15 minutes',
        last_error = $3,
        completed_at = NULL,
        updated_at = NOW()
      WHERE venue_id = $1
        AND snapshot_date = CURRENT_DATE
        AND period_days = $2
    `,
    [
      job.venue_id,
      job.period_days,
      String(error?.message || error).slice(0, 2000),
    ],
  );
}

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