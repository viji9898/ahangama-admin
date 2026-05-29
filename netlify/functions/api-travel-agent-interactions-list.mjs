import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText } from "./_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  TRAVEL_AGENT_CONTACTS_TABLE,
  TRAVEL_AGENT_INTERACTIONS_TABLE,
  toTravelAgentInteractionDto,
} from "./_lib/travelAgentCrm.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const qs = event.queryStringParameters || {};
    const companyId = normalizeLowerText(qs.companyId);
    const contactId = normalizeLowerText(qs.contactId);

    const where = ["1=1"];
    const params = [];
    let idx = 1;

    if (companyId) {
      where.push(`i.company_id = $${idx}`);
      params.push(companyId);
      idx += 1;
    }

    if (contactId) {
      where.push(`i.contact_id = $${idx}`);
      params.push(contactId);
      idx += 1;
    }

    const result = await query(
      `
        SELECT
          i.*, c.company_name, tc.full_name
        FROM ${TRAVEL_AGENT_INTERACTIONS_TABLE} i
        JOIN ${TRAVEL_AGENT_COMPANIES_TABLE} c ON c.id = i.company_id
        JOIN ${TRAVEL_AGENT_CONTACTS_TABLE} tc ON tc.id = i.contact_id
        WHERE ${where.join(" AND ")}
        ORDER BY i.interaction_at DESC, i.created_at DESC
        LIMIT 500
      `,
      params,
    );

    return json(200, {
      ok: true,
      interactions: result.rows.map(toTravelAgentInteractionDto),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
