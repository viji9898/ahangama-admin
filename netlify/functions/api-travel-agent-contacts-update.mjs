import { requireAdmin } from "./_lib/auth.mjs";
import { diffFields, logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "./_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  TRAVEL_AGENT_CONTACTS_TABLE,
  normalizeTravelAgentFullName,
  toTravelAgentContactDto,
} from "./_lib/travelAgentCrm.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const CONTACT_ACTIVITY_FIELDS = {
  company_id: "company",
  first_name: "first name",
  last_name: "last name",
  full_name: "full name",
  email: "email",
  whatsapp: "whatsapp",
  phone: "phone",
  notes: "notes",
  email_sent: "email sent",
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

    if (hasOwn(body, "fullName") && !normalizeOptionalText(body.fullName)) {
      return json(400, { ok: false, error: "fullName is required" });
    }

    const beforeResult = await query(
      `
        SELECT *
        FROM ${TRAVEL_AGENT_CONTACTS_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id],
    );
    if (beforeResult.rowCount === 0) {
      return json(404, { ok: false, error: "Contact not found" });
    }

    const nextCompanyId = hasOwn(body, "companyId")
      ? normalizeLowerText(body.companyId)
      : beforeResult.rows[0].company_id;
    if (!nextCompanyId) {
      return json(400, { ok: false, error: "companyId is required" });
    }

    const companyResult = await query(
      `
        SELECT id
        FROM ${TRAVEL_AGENT_COMPANIES_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [nextCompanyId],
    );
    if (companyResult.rowCount === 0) {
      return json(404, { ok: false, error: "Company not found" });
    }

    const actorEmail = normalizeLowerText(actor?.email);
    const result = await query(
      `
        WITH updated AS (
          UPDATE ${TRAVEL_AGENT_CONTACTS_TABLE}
          SET
            company_id = COALESCE($2, company_id),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            full_name = COALESCE($5, full_name),
            email = COALESCE($6, email),
            whatsapp = COALESCE($7, whatsapp),
            phone = COALESCE($8, phone),
            notes = COALESCE($9, notes),
            email_sent = COALESCE($10::boolean, email_sent),
            active = COALESCE($11::boolean, active),
            updated_by = COALESCE($12, updated_by)
          WHERE id = $1
            AND deleted_at IS NULL
          RETURNING *
        )
        SELECT u.*, c.company_name
        FROM updated u
        JOIN ${TRAVEL_AGENT_COMPANIES_TABLE} c ON c.id = u.company_id
      `,
      [
        id,
        hasOwn(body, "companyId") ? nextCompanyId : null,
        hasOwn(body, "firstName")
          ? normalizeOptionalText(body.firstName)
          : null,
        hasOwn(body, "lastName") ? normalizeOptionalText(body.lastName) : null,
        hasOwn(body, "fullName")
          ? normalizeTravelAgentFullName(body.fullName)
          : null,
        hasOwn(body, "email") ? normalizeLowerText(body.email) : null,
        hasOwn(body, "whatsapp") ? normalizeOptionalText(body.whatsapp) : null,
        hasOwn(body, "phone") ? normalizeOptionalText(body.phone) : null,
        hasOwn(body, "notes") ? normalizeOptionalText(body.notes) : null,
        hasOwn(body, "emailSent") ? Boolean(body.emailSent) : null,
        hasOwn(body, "active") ? Boolean(body.active) : null,
        actorEmail,
      ],
    );

    if (result.rowCount === 0) {
      return json(404, { ok: false, error: "Contact not found" });
    }

    const row = result.rows[0];
    const changedFields = diffFields(
      beforeResult.rows[0],
      row,
      CONTACT_ACTIVITY_FIELDS,
    );

    await logAdminActivity({
      action: "update",
      actorEmail: actor?.email,
      entityType: "travel_agent_contact",
      entityId: row.id,
      entityName: row.full_name,
      contactId: row.id,
      changedFields,
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
