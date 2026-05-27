import { requireAdmin } from "./_lib/auth.mjs";
import {
  logAdminActivity,
  normalizeActivityLowerText,
  normalizeActivityText,
} from "./_lib/adminActivity.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

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

    const entityType = normalizeActivityLowerText(body.entityType);
    const entityId = normalizeActivityLowerText(body.entityId);

    if (!entityType || !entityId) {
      return json(400, {
        ok: false,
        error: "entityType and entityId are required",
      });
    }

    await logAdminActivity({
      action: "view",
      actorEmail: actor?.email,
      entityType,
      entityId,
      entityName: normalizeActivityText(body.entityName),
      venueId: normalizeActivityLowerText(body.venueId) || (entityType === "venue" ? entityId : null),
      contactId: normalizeActivityLowerText(body.contactId) || (entityType === "contact" ? entityId : null),
      details: {
        source: normalizeActivityText(body.source) || "admin-ui",
      },
    });

    return json(200, { ok: true });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}