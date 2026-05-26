import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  PARTNER_INTERACTIONS_TABLE,
  PARTNER_TOUCHPOINT_INVENTORY_TABLE,
  makeInteractionId,
  makePartnerContactId,
  normalizeContactRole,
  normalizeInteractionOutcome,
  normalizeInteractionType,
  normalizeLowerText,
  normalizeOptionalText,
  normalizeQuantity,
  normalizeReferenceKey,
  normalizeTouchpointType,
} from "./_lib/crm.mjs";
import { parseCsv } from "./_lib/csv.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function asBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function pick(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
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
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const resource = String(body.resource || "contacts").trim().toLowerCase();
    const csv = String(body.csv || "");
    if (!csv.trim()) {
      return json(400, { ok: false, error: "csv is required" });
    }

    const actorEmail = normalizeLowerText(actor?.email);
    const rows = parseCsv(csv);
    const errors = [];
    let importedCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        if (resource === "contacts") {
          const referenceKey = normalizeReferenceKey(
            pick(row, "reference_key", "referenceKey"),
          );
          const role = normalizeContactRole(pick(row, "role"), "other");
          const venueId = normalizeLowerText(pick(row, "venue_id", "venueId"));
          const contactName = normalizeOptionalText(
            pick(row, "contact_name", "contactName"),
          );

          if (!referenceKey || !venueId || !contactName) {
            throw new Error("reference_key, venue_id, and contact_name are required");
          }

          const id =
            normalizeLowerText(pick(row, "id")) ||
            makePartnerContactId(referenceKey, role);

          await query(
            `
              INSERT INTO ${PARTNER_CONTACTS_TABLE} (
                id, venue_id, reference_key, contact_name, role,
                email, whatsapp, phone, notes,
                is_primary, active, created_by, updated_by, deleted_at
              )
              VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, $13, NULL
              )
              ON CONFLICT (reference_key)
              DO UPDATE SET
                venue_id = EXCLUDED.venue_id,
                contact_name = EXCLUDED.contact_name,
                role = EXCLUDED.role,
                email = EXCLUDED.email,
                whatsapp = EXCLUDED.whatsapp,
                phone = EXCLUDED.phone,
                notes = EXCLUDED.notes,
                is_primary = EXCLUDED.is_primary,
                active = EXCLUDED.active,
                updated_by = EXCLUDED.updated_by,
                deleted_at = NULL
            `,
            [
              id,
              venueId,
              referenceKey,
              contactName,
              role,
              normalizeLowerText(pick(row, "email")),
              normalizeOptionalText(pick(row, "whatsapp")),
              normalizeOptionalText(pick(row, "phone")),
              normalizeOptionalText(pick(row, "notes")),
              asBoolean(pick(row, "is_primary", "isPrimary"), false),
              asBoolean(pick(row, "active"), true),
              actorEmail,
              actorEmail,
            ],
          );
          importedCount += 1;
          continue;
        }

        if (resource === "touchpoints") {
          const venueId = normalizeLowerText(pick(row, "venue_id", "venueId"));
          const touchpointType = normalizeTouchpointType(
            pick(row, "touchpoint_type", "touchpointType"),
          );
          const quantity = normalizeQuantity(pick(row, "quantity"));

          if (!venueId) {
            throw new Error("venue_id is required");
          }

          await query(
            `
              INSERT INTO ${PARTNER_TOUCHPOINT_INVENTORY_TABLE} (
                venue_id, touchpoint_type, quantity, notes, updated_by
              )
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (venue_id, touchpoint_type)
              DO UPDATE SET
                quantity = EXCLUDED.quantity,
                notes = EXCLUDED.notes,
                updated_by = EXCLUDED.updated_by
            `,
            [
              venueId,
              touchpointType,
              quantity,
              normalizeOptionalText(pick(row, "notes")),
              actorEmail,
            ],
          );
          importedCount += 1;
          continue;
        }

        if (resource === "interactions") {
          const venueId = normalizeLowerText(pick(row, "venue_id", "venueId"));
          const interactionType = normalizeInteractionType(
            pick(row, "interaction_type", "interactionType"),
          );
          const summary = normalizeOptionalText(pick(row, "summary"));

          if (!venueId || !summary) {
            throw new Error("venue_id and summary are required");
          }

          const id =
            normalizeLowerText(pick(row, "id")) ||
            makeInteractionId(venueId, interactionType);

          await query(
            `
              INSERT INTO ${PARTNER_INTERACTIONS_TABLE} (
                id, venue_id, contact_id,
                interaction_type, outcome_status,
                summary, feedback, next_action,
                next_follow_up_at, interaction_at,
                created_by
              )
              VALUES (
                $1, $2, $3,
                $4, $5,
                $6, $7, $8,
                $9::timestamptz, COALESCE($10::timestamptz, NOW()),
                $11
              )
              ON CONFLICT (id)
              DO UPDATE SET
                venue_id = EXCLUDED.venue_id,
                contact_id = EXCLUDED.contact_id,
                interaction_type = EXCLUDED.interaction_type,
                outcome_status = EXCLUDED.outcome_status,
                summary = EXCLUDED.summary,
                feedback = EXCLUDED.feedback,
                next_action = EXCLUDED.next_action,
                next_follow_up_at = EXCLUDED.next_follow_up_at,
                interaction_at = EXCLUDED.interaction_at,
                created_by = EXCLUDED.created_by
            `,
            [
              id,
              venueId,
              normalizeLowerText(pick(row, "contact_id", "contactId")),
              interactionType,
              normalizeInteractionOutcome(
                pick(row, "outcome_status", "outcomeStatus"),
                "pending",
              ),
              summary,
              normalizeOptionalText(pick(row, "feedback")),
              normalizeOptionalText(pick(row, "next_action", "nextAction")),
              normalizeOptionalText(
                pick(row, "next_follow_up_at", "nextFollowUpAt"),
              ),
              normalizeOptionalText(pick(row, "interaction_at", "interactionAt")),
              actorEmail,
            ],
          );
          importedCount += 1;
          continue;
        }

        throw new Error(
          "resource must be one of contacts, touchpoints, interactions",
        );
      } catch (error) {
        errors.push({
          row: index + 2,
          error: String((error && error.message) || error),
        });
      }
    }

    return json(200, {
      ok: true,
      resource,
      importedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
