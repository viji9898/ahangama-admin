import { requireAdmin } from "./_lib/auth.mjs";
import { diffFields, logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
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

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const CONTACT_ACTIVITY_FIELDS = {
  venue_id: "venue",
  contact_name: "contact name",
  role: "role",
  email: "email",
  whatsapp: "whatsapp",
  phone: "phone",
  notes: "notes",
  is_primary: "primary contact",
  active: "active",
};

export async function handler(event) {
  try {
    if (event.httpMethod !== "PUT" && event.httpMethod !== "PATCH") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const id = normalizeLowerText(body.id);
    if (!id) return json(400, { ok: false, error: "id is required" });

    const beforeResult = await query(
      `
        SELECT *
        FROM ${PARTNER_CONTACTS_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id],
    );
    if (beforeResult.rowCount === 0) {
      return json(404, { ok: false, error: "Contact not found" });
    }
    const beforeRow = beforeResult.rows[0];

    if (
      hasOwn(body, "contactName") &&
      !normalizeOptionalText(body.contactName)
    ) {
      return json(400, { ok: false, error: "contactName is required" });
    }

    const actorEmail = normalizeLowerText(actor?.email);

    const sql = `
      WITH updated AS (
        UPDATE ${PARTNER_CONTACTS_TABLE}
        SET
          venue_id = COALESCE($2, venue_id),
          contact_name = COALESCE($3, contact_name),
          role = COALESCE($4, role),
          email = COALESCE($5, email),
          whatsapp = COALESCE($6, whatsapp),
          phone = COALESCE($7, phone),
          notes = COALESCE($8, notes),
          is_primary = COALESCE($9::boolean, is_primary),
          active = COALESCE($10::boolean, active),
          updated_by = COALESCE($11, updated_by)
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING *
      )
      SELECT u.*, v.name AS venue_name
      FROM updated u
      JOIN ${VENUES_TABLE} v ON v.id = u.venue_id
    `;

    const params = [
      id,
      hasOwn(body, "venueId") ? normalizeLowerText(body.venueId) : null,
      hasOwn(body, "contactName")
        ? normalizeOptionalText(body.contactName)
        : null,
      hasOwn(body, "role") ? normalizeContactRole(body.role) : null,
      hasOwn(body, "email") ? normalizeLowerText(body.email) : null,
      hasOwn(body, "whatsapp") ? normalizeOptionalText(body.whatsapp) : null,
      hasOwn(body, "phone") ? normalizeOptionalText(body.phone) : null,
      hasOwn(body, "notes") ? normalizeOptionalText(body.notes) : null,
      hasOwn(body, "isPrimary") ? Boolean(body.isPrimary) : null,
      hasOwn(body, "active") ? Boolean(body.active) : null,
      actorEmail,
    ];

    const result = await query(sql, params);
    if (result.rowCount === 0) {
      return json(404, { ok: false, error: "Contact not found" });
    }

    const row = result.rows[0];
    const changedFields = diffFields(beforeRow, row, CONTACT_ACTIVITY_FIELDS);

    await logAdminActivity({
      action: "update",
      actorEmail: actor?.email,
      entityType: "contact",
      entityId: row.id,
      entityName: row.contact_name,
      venueId: row.venue_id,
      contactId: row.id,
      changedFields,
    });

    return json(200, { ok: true, contact: toPartnerContactDto(row) });
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
