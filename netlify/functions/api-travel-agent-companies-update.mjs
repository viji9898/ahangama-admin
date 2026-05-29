import { requireAdmin } from "./_lib/auth.mjs";
import { diffFields, logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "./_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  normalizeTravelAgentCompanyName,
  toTravelAgentCompanyDto,
} from "./_lib/travelAgentCrm.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const COMPANY_ACTIVITY_FIELDS = {
  company_name: "company name",
  notes: "notes",
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

    if (hasOwn(body, "companyName") && !normalizeOptionalText(body.companyName)) {
      return json(400, { ok: false, error: "companyName is required" });
    }

    const beforeResult = await query(
      `
        SELECT *
        FROM ${TRAVEL_AGENT_COMPANIES_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id],
    );
    if (beforeResult.rowCount === 0) {
      return json(404, { ok: false, error: "Company not found" });
    }

    const actorEmail = normalizeLowerText(actor?.email);
    const result = await query(
      `
        UPDATE ${TRAVEL_AGENT_COMPANIES_TABLE}
        SET
          company_name = COALESCE($2, company_name),
          notes = COALESCE($3, notes),
          active = COALESCE($4::boolean, active),
          updated_by = COALESCE($5, updated_by)
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING *
      `,
      [
        id,
        hasOwn(body, "companyName")
          ? normalizeTravelAgentCompanyName(body.companyName)
          : null,
        hasOwn(body, "notes") ? normalizeOptionalText(body.notes) : null,
        hasOwn(body, "active") ? Boolean(body.active) : null,
        actorEmail,
      ],
    );

    if (result.rowCount === 0) {
      return json(404, { ok: false, error: "Company not found" });
    }

    const row = result.rows[0];
    const changedFields = diffFields(
      beforeResult.rows[0],
      row,
      COMPANY_ACTIVITY_FIELDS,
    );

    await logAdminActivity({
      action: "update",
      actorEmail: actor?.email,
      entityType: "travel_agent_company",
      entityId: row.id,
      entityName: row.company_name,
      changedFields,
    });

    return json(200, { ok: true, company: toTravelAgentCompanyDto(row) });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes("duplicate")) {
      return json(409, {
        ok: false,
        error: "Duplicate company name or id",
      });
    }

    return json(e?.statusCode || 500, { ok: false, error: msg });
  }
}