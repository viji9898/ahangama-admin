import { requireAdmin } from "./_lib/auth.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "./_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  makeTravelAgentCompanyId,
  normalizeTravelAgentCompanyName,
  toTravelAgentCompanyDto,
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

    const companyName = normalizeTravelAgentCompanyName(body.companyName);
    const id =
      normalizeLowerText(body.id) || makeTravelAgentCompanyId(companyName);
    const notes = normalizeOptionalText(body.notes);
    const active = typeof body.active === "boolean" ? body.active : true;
    const actorEmail = normalizeLowerText(actor?.email);

    const result = await query(
      `
        INSERT INTO ${TRAVEL_AGENT_COMPANIES_TABLE} (
          id, company_name, notes, active, created_by, updated_by, deleted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NULL)
        RETURNING *
      `,
      [id, companyName, notes, active, actorEmail, actorEmail],
    );

    const row = result.rows[0];

    await logAdminActivity({
      action: "create",
      actorEmail: actor?.email,
      entityType: "travel_agent_company",
      entityId: row.id,
      entityName: row.company_name,
      details: {
        active: row.active,
      },
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