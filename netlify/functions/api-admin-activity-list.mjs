import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  ADMIN_ACTIVITY_TABLE,
  toAdminActivityDto,
} from "./_lib/adminActivity.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const qs = event.queryStringParameters || {};
    const requestedLimit = Number(qs.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;

    const result = await query(
      `
        SELECT *
        FROM ${ADMIN_ACTIVITY_TABLE}
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return json(200, {
      ok: true,
      activities: result.rows.map(toAdminActivityDto),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}