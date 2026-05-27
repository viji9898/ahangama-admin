import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  PARTNER_INTERACTIONS_TABLE,
  PARTNER_TOUCHPOINT_INVENTORY_TABLE,
  normalizeLowerText,
} from "./_lib/crm.mjs";
import { toCsv } from "./_lib/csv.mjs";

const csvResponse = (filename, csv) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename=\"${filename}\"`,
    "Cache-Control": "no-store",
  },
  body: csv,
});

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
    const resource = String(qs.resource || "contacts")
      .trim()
      .toLowerCase();
    const venueId = normalizeLowerText(qs.venueId);

    if (resource === "contacts") {
      const params = [];
      const where = ["deleted_at IS NULL"];
      if (venueId) {
        where.push(`venue_id = $1`);
        params.push(venueId);
      }

      const result = await query(
        `
          SELECT
            id, venue_id, contact_name, role,
            email, whatsapp, phone, notes,
            is_primary, active, created_by, updated_by,
            created_at, updated_at
          FROM ${PARTNER_CONTACTS_TABLE}
          WHERE ${where.join(" AND ")}
          ORDER BY updated_at DESC
        `,
        params,
      );

      const csv = toCsv(
        [
          { key: "id", label: "id" },
          { key: "venue_id", label: "venue_id" },
          { key: "contact_name", label: "contact_name" },
          { key: "role", label: "role" },
          { key: "email", label: "email" },
          { key: "whatsapp", label: "whatsapp" },
          { key: "phone", label: "phone" },
          { key: "notes", label: "notes" },
          { key: "is_primary", label: "is_primary" },
          { key: "active", label: "active" },
          { key: "created_by", label: "created_by" },
          { key: "updated_by", label: "updated_by" },
          { key: "created_at", label: "created_at" },
          { key: "updated_at", label: "updated_at" },
        ],
        result.rows,
      );
      return csvResponse("partner_contacts.csv", csv);
    }

    if (resource === "touchpoints") {
      const params = [];
      const where = ["1=1"];
      if (venueId) {
        where.push(`venue_id = $1`);
        params.push(venueId);
      }

      const result = await query(
        `
          SELECT
            venue_id, touchpoint_type, quantity, notes,
            updated_by, created_at, updated_at
          FROM ${PARTNER_TOUCHPOINT_INVENTORY_TABLE}
          WHERE ${where.join(" AND ")}
          ORDER BY updated_at DESC
        `,
        params,
      );

      const csv = toCsv(
        [
          { key: "venue_id", label: "venue_id" },
          { key: "touchpoint_type", label: "touchpoint_type" },
          { key: "quantity", label: "quantity" },
          { key: "notes", label: "notes" },
          { key: "updated_by", label: "updated_by" },
          { key: "created_at", label: "created_at" },
          { key: "updated_at", label: "updated_at" },
        ],
        result.rows,
      );
      return csvResponse("partner_touchpoints.csv", csv);
    }

    if (resource === "interactions") {
      const params = [];
      const where = ["1=1"];
      if (venueId) {
        where.push(`venue_id = $1`);
        params.push(venueId);
      }

      const result = await query(
        `
          SELECT
            id, venue_id, contact_id,
            interaction_type, outcome_status,
            summary, feedback, next_action,
            next_follow_up_at, interaction_at,
            created_by, created_at
          FROM ${PARTNER_INTERACTIONS_TABLE}
          WHERE ${where.join(" AND ")}
          ORDER BY interaction_at DESC
        `,
        params,
      );

      const csv = toCsv(
        [
          { key: "id", label: "id" },
          { key: "venue_id", label: "venue_id" },
          { key: "contact_id", label: "contact_id" },
          { key: "interaction_type", label: "interaction_type" },
          { key: "outcome_status", label: "outcome_status" },
          { key: "summary", label: "summary" },
          { key: "feedback", label: "feedback" },
          { key: "next_action", label: "next_action" },
          { key: "next_follow_up_at", label: "next_follow_up_at" },
          { key: "interaction_at", label: "interaction_at" },
          { key: "created_by", label: "created_by" },
          { key: "created_at", label: "created_at" },
        ],
        result.rows,
      );
      return csvResponse("partner_interactions.csv", csv);
    }

    return json(400, {
      ok: false,
      error: "resource must be one of contacts, touchpoints, interactions",
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
