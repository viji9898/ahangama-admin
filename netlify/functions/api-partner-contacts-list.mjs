import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  toPartnerContactDto,
  normalizeLowerText,
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
    const q = String(qs.q || "")
      .trim()
      .toLowerCase();
    const venueId = normalizeLowerText(qs.venueId);
    const role = normalizeLowerText(qs.role);
    const activeRaw = normalizeLowerText(qs.active);
    const activeFilter =
      activeRaw === "true" ? true : activeRaw === "false" ? false : null;

    const where = ["c.deleted_at IS NULL"];
    const params = [];
    let idx = 1;

    if (venueId) {
      where.push(`c.venue_id = $${idx}`);
      params.push(venueId);
      idx += 1;
    }

    if (role) {
      where.push(`c.role = $${idx}`);
      params.push(role);
      idx += 1;
    }

    if (activeFilter !== null) {
      where.push(`c.active = $${idx}`);
      params.push(activeFilter);
      idx += 1;
    }

    if (q) {
      where.push(`(
        lower(c.contact_name) LIKE $${idx}
        OR lower(c.reference_key) LIKE $${idx}
        OR lower(coalesce(c.email, '')) LIKE $${idx}
        OR lower(coalesce(c.whatsapp, '')) LIKE $${idx}
        OR lower(coalesce(c.phone, '')) LIKE $${idx}
        OR lower(coalesce(c.notes, '')) LIKE $${idx}
        OR lower(coalesce(v.name, '')) LIKE $${idx}
      )`);
      params.push(`%${q}%`);
      idx += 1;
    }

    const sql = `
      SELECT
        c.*,
        v.name AS venue_name
      FROM ${PARTNER_CONTACTS_TABLE} c
      JOIN ${VENUES_TABLE} v ON v.id = c.venue_id
      WHERE ${where.join(" AND ")}
      ORDER BY c.updated_at DESC, c.reference_key ASC
      LIMIT 1000
    `;

    const result = await query(sql, params);
    return json(200, {
      ok: true,
      contacts: result.rows.map(toPartnerContactDto),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
