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

    if (event.queryStringParameters?.summary === "true") {
      const countResult = await queryFromEnv(
        DATABASE_ENV,
        `SELECT COUNT(*)::int AS unread_count FROM retreat_enquiries WHERE is_read = false`,
      );

      return json(200, {
        ok: true,
        unreadCount: countResult.rows[0]?.unread_count || 0,
      });
    }

    const result = await queryFromEnv(
      DATABASE_ENV,
      `
        SELECT
          id::text,
          preferred_venue,
          retreat_style,
          start_date,
          end_date,
          expected_guests,
          organiser_name,
          email,
          whatsapp,
          notes,
          source,
          status,
          is_read,
          notification_sent_at,
          created_at,
          updated_at
        FROM retreat_enquiries
        ORDER BY created_at DESC
        LIMIT 1000
      `,
    );
    const countResult = await queryFromEnv(
      DATABASE_ENV,
      `SELECT COUNT(*)::int AS unread_count FROM retreat_enquiries WHERE is_read = false`,
    );

    return json(200, {
      ok: true,
      enquiries: result.rows,
      unreadCount: countResult.rows[0]?.unread_count || 0,
    });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}