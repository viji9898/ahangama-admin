import { requireAdmin } from "./_lib/auth.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "./_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  TRAVEL_AGENT_CONTACTS_TABLE,
  makeTravelAgentContactId,
  normalizeTravelAgentFullName,
  toTravelAgentContactDto,
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
    if (!companyId) return badRequest("companyId is required");

    const fullName = normalizeTravelAgentFullName(body.fullName);
    const id =
      normalizeLowerText(body.id) ||
      makeTravelAgentContactId(companyId, fullName);
    const firstName = normalizeOptionalText(body.firstName);
    const lastName = normalizeOptionalText(body.lastName);
    const email = normalizeLowerText(body.email);
    const whatsapp = normalizeOptionalText(body.whatsapp);
    const phone = normalizeOptionalText(body.phone);
    const notes = normalizeOptionalText(body.notes);
    const emailSent =
      typeof body.emailSent === "boolean" ? body.emailSent : false;
    const active = typeof body.active === "boolean" ? body.active : true;
    const actorEmail = normalizeLowerText(actor?.email);

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

    const result = await query(
      `
        WITH inserted AS (
          INSERT INTO ${TRAVEL_AGENT_CONTACTS_TABLE} (
            id, company_id, first_name, last_name, full_name,
            email, whatsapp, phone, notes,
            email_sent, active, created_by, updated_by, deleted_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, NULL
          )
          RETURNING *
        )
        SELECT i.*, c.company_name
        FROM inserted i
        JOIN ${TRAVEL_AGENT_COMPANIES_TABLE} c ON c.id = i.company_id
      `,
      [
        id,
        companyId,
        firstName,
        lastName,
        fullName,
        email,
        whatsapp,
        phone,
        notes,
        emailSent,
        active,
        actorEmail,
        actorEmail,
      ],
    );

    const row = result.rows[0];
    await logAdminActivity({
      action: "create",
      actorEmail: actor?.email,
      entityType: "travel_agent_contact",
      entityId: row.id,
      entityName: row.full_name,
      contactId: row.id,
      details: {
        companyId: row.company_id,
        companyName: row.company_name,
      },
    });

    return json(200, { ok: true, contact: toTravelAgentContactDto(row) });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes("duplicate")) {
      return json(409, {
        ok: false,
        error: "Duplicate contact id",
      });
    }

    return json(e?.statusCode || 500, { ok: false, error: msg });
  }
}
