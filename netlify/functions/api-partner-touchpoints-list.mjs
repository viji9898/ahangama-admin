import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_TOUCHPOINT_INVENTORY_TABLE,
  normalizeLowerText,
  toTouchpointInventoryDto,
} from "./_lib/crm.mjs";
import { VENUES_TABLE } from "./_lib/venues260414.mjs";

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
    const venueId = normalizeLowerText(qs.venueId);

    const where = ["1=1"];
    const params = [];
    let idx = 1;

    if (venueId) {
      where.push(`t.venue_id = $${idx}`);
      params.push(venueId);
      idx += 1;
    }

    const sql = `
      SELECT
        t.*,
        v.name AS venue_name
      FROM ${PARTNER_TOUCHPOINT_INVENTORY_TABLE} t
      JOIN ${VENUES_TABLE} v ON v.id = t.venue_id
      WHERE ${where.join(" AND ")}
      ORDER BY v.name ASC, t.touchpoint_type ASC
    `;

    const result = await query(sql, params);
    return json(200, {
      ok: true,
      touchpoints: result.rows.map(toTouchpointInventoryDto),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
