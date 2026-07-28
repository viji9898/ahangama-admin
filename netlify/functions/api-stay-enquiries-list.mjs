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
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const result = await queryFromEnv(
      DATABASE_ENV,
      `
        SELECT
          id::text,
          property_slug,
          check_in,
          check_out,
          adults,
          children,
          budget,
          guest_name,
          email,
          whatsapp,
          notes,
          source,
          status,
          notification_sent_at,
          created_at,
          updated_at
        FROM stay_enquiries
        ORDER BY created_at DESC
        LIMIT 1000
      `,
    );

    return json(200, { ok: true, enquiries: result.rows });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}