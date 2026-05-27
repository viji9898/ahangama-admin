import { requireAdmin } from "./_lib/auth.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  PARTNER_INTERACTIONS_TABLE,
  makeInteractionId,
  normalizeInteractionOutcome,
  normalizeInteractionType,
  normalizeLowerText,
  normalizeOptionalText,
  toPartnerInteractionDto,
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
    const interactionType = normalizeInteractionType(body.interactionType);
    const outcomeStatus = normalizeInteractionOutcome(body.outcomeStatus, "pending");
    const summary = normalizeOptionalText(body.summary);

    if (!venueId) return badRequest("venueId is required");
    if (!summary) return badRequest("summary is required");

    const id =
      normalizeLowerText(body.id) || makeInteractionId(venueId, interactionType);

    const contactId = normalizeLowerText(body.contactId);
    const feedback = normalizeOptionalText(body.feedback);
    const nextAction = normalizeOptionalText(body.nextAction);
    const nextFollowUpAt = normalizeOptionalText(body.nextFollowUpAt);
    const interactionAt = normalizeOptionalText(body.interactionAt);
    const createdBy = normalizeLowerText(actor?.email);

    const sql = `
      WITH inserted AS (
        INSERT INTO ${PARTNER_INTERACTIONS_TABLE} (
          id, venue_id, contact_id, interaction_type, outcome_status, summary,
          feedback, next_action, next_follow_up_at, interaction_at,
          created_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9::timestamptz,
          COALESCE($10::timestamptz, NOW()),
          $11
        )
        RETURNING *
      )
      SELECT
        i.*,
        v.name AS venue_name,
        c.contact_name
      FROM inserted i
      JOIN ${VENUES_TABLE} v ON v.id = i.venue_id
      LEFT JOIN ${PARTNER_CONTACTS_TABLE} c ON c.id = i.contact_id
    `;

    const result = await query(sql, [
      id,
      venueId,
      contactId,
      interactionType,
      outcomeStatus,
      summary,
      feedback,
      nextAction,
      nextFollowUpAt,
      interactionAt,
      createdBy,
    ]);

    const row = result.rows[0];

    await logAdminActivity({
      action: "create",
      actorEmail: actor?.email,
      entityType: "interaction",
      entityId: row.id,
      entityName: row.summary,
      venueId: row.venue_id,
      contactId: row.contact_id,
      details: {
        interactionType: row.interaction_type,
        outcomeStatus: row.outcome_status,
        contactName: row.contact_name,
      },
    });

    return json(200, {
      ok: true,
      interaction: toPartnerInteractionDto(row),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
