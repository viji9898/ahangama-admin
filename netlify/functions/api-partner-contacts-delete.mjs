import { requireAdmin } from "./_lib/auth.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { PARTNER_CONTACTS_TABLE, normalizeLowerText } from "./_lib/crm.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "DELETE") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    const qs = event.queryStringParameters || {};
    let id = normalizeLowerText(qs.id);

    if (!id && event.body) {
      try {
        const body = JSON.parse(event.body);
        id = normalizeLowerText(body.id);
      } catch {
        return json(400, { ok: false, error: "Invalid JSON body" });
      }
    }

    if (!id) {
      return json(400, { ok: false, error: "id is required" });
    }

    const actorEmail = normalizeLowerText(actor?.email);

    const result = await query(
      `
        UPDATE ${PARTNER_CONTACTS_TABLE}
        SET deleted_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id, venue_id, contact_name;
      `,
      [id, actorEmail],
    );

    if (result.rowCount === 0) {
      return json(404, { ok: false, error: "Contact not found" });
    }

    await logAdminActivity({
      action: "delete",
      actorEmail: actor?.email,
      entityType: "contact",
      entityId: result.rows[0].id,
      entityName: result.rows[0].contact_name,
      venueId: result.rows[0].venue_id,
      contactId: result.rows[0].id,
    });

    return json(200, { ok: true, deletedId: result.rows[0].id });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
