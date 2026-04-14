import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import { VENUES_TABLE } from "./_lib/venues260414.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "DELETE") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    // Allow id from querystring or JSON body
    const qs = event.queryStringParameters || {};
    let id = String(qs.id || "")
      .trim()
      .toLowerCase();

    if (!id && event.body) {
      try {
        const body = JSON.parse(event.body);
        id = String(body.id || "")
          .trim()
          .toLowerCase();
      } catch {
        // ignore parse errors; we'll validate below
      }
    }

    if (!id) {
      return json(400, { ok: false, error: "id is required" });
    }

    const r = await query(
      `
        UPDATE ${VENUES_TABLE}
        SET deleted_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id;
      `,
      [id, actor?.email ? String(actor.email).trim().toLowerCase() : null],
    );

    if (r.rowCount === 0) {
      return json(404, { ok: false, error: "Venue not found" });
    }

    return json(200, { ok: true, deletedId: r.rows[0].id });
  } catch (e) {
    return json(e.statusCode || 500, {
      ok: false,
      error: String(e.message || e),
    });
  }
}
