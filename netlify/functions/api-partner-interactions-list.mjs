import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  PARTNER_INTERACTIONS_TABLE,
  normalizeLowerText,
  toPartnerInteractionDto,
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
    const contactId = normalizeLowerText(qs.contactId);

    const where = ["1=1"];
    const params = [];
    let idx = 1;

    if (venueId) {
      where.push(`i.venue_id = $${idx}`);
      params.push(venueId);
      idx += 1;
    }

    if (contactId) {
      where.push(`i.contact_id = $${idx}`);
      params.push(contactId);
      idx += 1;
    }

    const sql = `
      SELECT
        i.*,
        v.name AS venue_name,
        c.contact_name
      FROM ${PARTNER_INTERACTIONS_TABLE} i
      JOIN ${VENUES_TABLE} v ON v.id = i.venue_id
      LEFT JOIN ${PARTNER_CONTACTS_TABLE} c ON c.id = i.contact_id
      WHERE ${where.join(" AND ")}
      ORDER BY i.interaction_at DESC, i.created_at DESC
      LIMIT 500
    `;

    const result = await query(sql, params);
    return json(200, {
      ok: true,
      interactions: result.rows.map(toPartnerInteractionDto),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
