import { requireAdmin } from "./_lib/auth.mjs";
import { diffFields, logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_TOUCHPOINT_INVENTORY_TABLE,
  normalizeLowerText,
  normalizeOptionalText,
  normalizeQuantity,
  normalizeTouchpointType,
  toTouchpointInventoryDto,
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
    const touchpointType = normalizeTouchpointType(body.touchpointType);

    if (!venueId) return badRequest("venueId is required");

    const quantity = normalizeQuantity(body.quantity);
    const notes = normalizeOptionalText(body.notes);
    const actorEmail = normalizeLowerText(actor?.email);

    const beforeResult = await query(
      `
        SELECT *
        FROM ${PARTNER_TOUCHPOINT_INVENTORY_TABLE}
        WHERE venue_id = $1
          AND touchpoint_type = $2
      `,
      [venueId, touchpointType],
    );
    const beforeRow = beforeResult.rows[0] || null;

    const sql = `
      WITH upserted AS (
        INSERT INTO ${PARTNER_TOUCHPOINT_INVENTORY_TABLE} (
          venue_id, touchpoint_type, quantity, notes, updated_by
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (venue_id, touchpoint_type)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by
        RETURNING *
      )
      SELECT u.*, v.name AS venue_name
      FROM upserted u
      JOIN ${VENUES_TABLE} v ON v.id = u.venue_id
    `;

    const result = await query(sql, [
      venueId,
      touchpointType,
      quantity,
      notes,
      actorEmail,
    ]);

    const row = result.rows[0];
    const changedFields = beforeRow
      ? diffFields(beforeRow, row, {
          quantity: "quantity",
          notes: "notes",
        })
      : ["quantity", ...(row.notes ? ["notes"] : [])];

    await logAdminActivity({
      action: beforeRow ? "update" : "create",
      actorEmail: actor?.email,
      entityType: "touchpoint",
      entityId: `${row.venue_id}:${row.touchpoint_type}`,
      entityName: row.touchpoint_type,
      venueId: row.venue_id,
      changedFields,
      details: {
        quantity: row.quantity,
        venueName: row.venue_name,
      },
    });

    return json(200, {
      ok: true,
      touchpoint: toTouchpointInventoryDto(row),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
