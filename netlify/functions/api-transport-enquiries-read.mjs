import { requireAdmin } from "./_lib/auth.mjs";
import { queryFromEnv } from "./_lib/db.mjs";

const DATABASE_ENV = "NETLIFY_DATABASE_URL";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "PATCH") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const body = JSON.parse(event.body || "{}");
    const id = String(body.id || "").trim();
    if (!id || typeof body.isRead !== "boolean") {
      return json(400, {
        ok: false,
        error: "id and boolean isRead are required",
      });
    }

    const result = await queryFromEnv(
      DATABASE_ENV,
      `
        UPDATE transport_enquiries
        SET is_read = $2, updated_at = now()
        WHERE id = $1
        RETURNING id::text, is_read, updated_at
      `,
      [id, body.isRead],
    );

    if (!result.rows[0]) {
      return json(404, { ok: false, error: "Transport enquiry not found" });
    }

    return json(200, { ok: true, enquiry: result.rows[0] });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}