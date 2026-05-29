import { requireAdmin } from "./_lib/auth.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "./_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  TRAVEL_AGENT_CONTACTS_TABLE,
  TRAVEL_AGENT_INTERACTIONS_TABLE,
  makeTravelAgentInteractionId,
  normalizeTravelAgentInteractionOutcome,
  normalizeTravelAgentInteractionType,
  toTravelAgentInteractionDto,
} from "./_lib/travelAgentCrm.mjs";

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

    const companyId = normalizeLowerText(body.companyId);
    const contactId = normalizeLowerText(body.contactId);
    const interactionType = normalizeTravelAgentInteractionType(
      body.interactionType,
    );
    const outcomeStatus = normalizeTravelAgentInteractionOutcome(
      body.outcomeStatus,
      "pending",
    );
    const summary = normalizeOptionalText(body.summary);

    if (!companyId) return badRequest("companyId is required");
    if (!contactId) return badRequest("contactId is required");
    if (!summary) return badRequest("summary is required");

    const companyResult = await query(
      `
        SELECT id, company_name
        FROM ${TRAVEL_AGENT_COMPANIES_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [companyId],
    );
    if (companyResult.rowCount === 0) {
      return json(404, { ok: false, error: "Company not found" });
    }

    const contactResult = await query(
      `
        SELECT id, full_name, company_id
        FROM ${TRAVEL_AGENT_CONTACTS_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [contactId],
    );
    if (contactResult.rowCount === 0) {
      return json(404, { ok: false, error: "Contact not found" });
    }
    if (contactResult.rows[0].company_id !== companyId) {
      return badRequest("contactId does not belong to companyId");
    }

    const id =
      normalizeLowerText(body.id) ||
      makeTravelAgentInteractionId(companyId, contactId, interactionType);
    const feedback = normalizeOptionalText(body.feedback);
    const nextAction = normalizeOptionalText(body.nextAction);
    const nextFollowUpAt = normalizeOptionalText(body.nextFollowUpAt);
    const interactionAt = normalizeOptionalText(body.interactionAt);
    const createdBy = normalizeLowerText(actor?.email);

    const result = await query(
      `
        WITH inserted AS (
          INSERT INTO ${TRAVEL_AGENT_INTERACTIONS_TABLE} (
            id, company_id, contact_id, interaction_type, outcome_status, summary,
            feedback, next_action, next_follow_up_at, interaction_at, created_by
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9::timestamptz,
            COALESCE($10::timestamptz, NOW()),
            $11
          )
          RETURNING *
        )
        SELECT i.*, c.company_name, tc.full_name
        FROM inserted i
        JOIN ${TRAVEL_AGENT_COMPANIES_TABLE} c ON c.id = i.company_id
        JOIN ${TRAVEL_AGENT_CONTACTS_TABLE} tc ON tc.id = i.contact_id
      `,
      [
        id,
        companyId,
        contactId,
        interactionType,
        outcomeStatus,
        summary,
        feedback,
        nextAction,
        nextFollowUpAt,
        interactionAt,
        createdBy,
      ],
    );

    const row = result.rows[0];
    await logAdminActivity({
      action: "create",
      actorEmail: actor?.email,
      entityType: "travel_agent_interaction",
      entityId: row.id,
      entityName: row.summary,
      contactId: row.contact_id,
      details: {
        companyId: row.company_id,
        companyName: row.company_name,
        contactName: row.full_name,
        interactionType: row.interaction_type,
        outcomeStatus: row.outcome_status,
      },
    });

    return json(200, {
      ok: true,
      interaction: toTravelAgentInteractionDto(row),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
