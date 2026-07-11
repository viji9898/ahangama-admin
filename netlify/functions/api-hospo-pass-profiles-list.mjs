import { requireAdmin } from "./_lib/auth.mjs";
import { queryFromEnv } from "./_lib/db.mjs";

const TABLE_NAME = "hospo_pass_profiles";
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

    const columnsResult = await queryFromEnv(
      DATABASE_ENV,
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [TABLE_NAME],
    );

    const columns = columnsResult.rows.map((row) => row.column_name);
    if (!columns.length) {
      return json(404, {
        ok: false,
        error: `Table not found: ${TABLE_NAME}`,
      });
    }

    const profilesResult = await queryFromEnv(
      DATABASE_ENV,
      `SELECT * FROM ${TABLE_NAME} LIMIT 1000`,
    );

    return json(200, {
      ok: true,
      columns,
      profiles: profilesResult.rows,
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
