import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  TRAVEL_AGENT_CONTACTS_TABLE,
  toTravelAgentCompanyDto,
  toTravelAgentContactDto,
} from "./_lib/travelAgentCrm.mjs";
import { normalizeLowerText } from "./_lib/crm.mjs";

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
    const q = String(qs.q || "")
      .trim()
      .toLowerCase();
    const activeRaw = normalizeLowerText(qs.active);
    const activeFilter =
      activeRaw === "true" ? true : activeRaw === "false" ? false : null;

    const where = ["c.deleted_at IS NULL"];
    const params = [];
    let idx = 1;

    if (activeFilter !== null) {
      where.push(`c.active = $${idx}`);
      params.push(activeFilter);
      idx += 1;
    }

    if (q) {
      where.push(`(
        lower(c.company_name) LIKE $${idx}
        OR lower(coalesce(c.notes, '')) LIKE $${idx}
        OR EXISTS (
          SELECT 1
          FROM ${TRAVEL_AGENT_CONTACTS_TABLE} tc
          WHERE tc.company_id = c.id
            AND tc.deleted_at IS NULL
            AND (
              lower(tc.full_name) LIKE $${idx}
              OR lower(coalesce(tc.email, '')) LIKE $${idx}
              OR lower(coalesce(tc.whatsapp, '')) LIKE $${idx}
              OR lower(coalesce(tc.phone, '')) LIKE $${idx}
            )
        )
      )`);
      params.push(`%${q}%`);
      idx += 1;
    }

    const companiesResult = await query(
      `
        SELECT *
        FROM ${TRAVEL_AGENT_COMPANIES_TABLE} c
        WHERE ${where.join(" AND ")}
        ORDER BY c.updated_at DESC, c.company_name ASC
        LIMIT 1000
      `,
      params,
    );

    const companies = companiesResult.rows.map(toTravelAgentCompanyDto);
    if (!companies.length) {
      return json(200, { ok: true, companies: [] });
    }

    const companyIds = companies.map((company) => company.id);
    const contactsResult = await query(
      `
        SELECT tc.*, c.company_name
        FROM ${TRAVEL_AGENT_CONTACTS_TABLE} tc
        JOIN ${TRAVEL_AGENT_COMPANIES_TABLE} c ON c.id = tc.company_id
        WHERE tc.deleted_at IS NULL
          AND tc.company_id = ANY($1::text[])
        ORDER BY tc.full_name ASC, tc.created_at ASC
      `,
      [companyIds],
    );

    const contactsByCompanyId = new Map();
    contactsResult.rows.forEach((row) => {
      const contact = toTravelAgentContactDto(row);
      const items = contactsByCompanyId.get(contact.companyId) || [];
      items.push(contact);
      contactsByCompanyId.set(contact.companyId, items);
    });

    return json(200, {
      ok: true,
      companies: companies.map((company) => ({
        ...company,
        contacts: contactsByCompanyId.get(company.id) || [],
      })),
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}