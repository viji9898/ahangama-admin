import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  makePartnerContactId,
  normalizeContactRole,
  normalizeLowerText,
  normalizeOptionalText,
  toPartnerContactDto,
} from "./_lib/crm.mjs";
import { VENUES_TABLE } from "./_lib/venues260414.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function badRequest(message) {
  return json(400, { ok: false, error: message });
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }

    const venueId = normalizeLowerText(body.venueId);
    const contactName = normalizeOptionalText(body.contactName);
    const role = normalizeContactRole(body.role, "other");

    if (!venueId) return badRequest("venueId is required");
    if (!contactName) return badRequest("contactName is required");

    const id = normalizeLowerText(body.id) || makePartnerContactId(venueId, role);

    const email = normalizeLowerText(body.email);
    const whatsapp = normalizeOptionalText(body.whatsapp);
    const phone = normalizeOptionalText(body.phone);
    const notes = normalizeOptionalText(body.notes);
    const isPrimary =
      typeof body.isPrimary === "boolean" ? body.isPrimary : false;
    const active = typeof body.active === "boolean" ? body.active : true;

    const actorEmail = normalizeLowerText(actor?.email);

    const sql = `
      WITH inserted AS (
        INSERT INTO ${PARTNER_CONTACTS_TABLE} (
          id, venue_id, reference_key, contact_name, role,
          email, whatsapp, phone, notes,
          is_primary, active, created_by, updated_by, deleted_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, NULL
        )
        RETURNING *
      )
      SELECT i.*, v.name AS venue_name
      FROM inserted i
      JOIN ${VENUES_TABLE} v ON v.id = i.venue_id
    `;

    const result = await query(sql, [
      id,
      venueId,
      null,
      contactName,
      role,
      email,
      whatsapp,
      phone,
      notes,
      isPrimary,
      active,
      actorEmail,
      actorEmail,
    ]);

    return json(200, { ok: true, contact: toPartnerContactDto(result.rows[0]) });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes("duplicate")) {
      return json(409, {
        ok: false,
        error: "Duplicate contact id",
      });
    }

    return json(e?.statusCode || 500, {
      ok: false,
      error: msg,
    });
  }
}
