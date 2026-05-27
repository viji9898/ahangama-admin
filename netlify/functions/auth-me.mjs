import { query } from "./_lib/db.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { getClientContext, getSessionAdmin } from "./_lib/auth.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  const user = getSessionAdmin(event);
  if (!user) return json(401, { ok: false });

  try {
    const email = String(user?.email || "").toLowerCase();
    const dateKey = new Date().toISOString().slice(0, 10);
    const presenceEntityId = `presence:${dateKey}:${email}`;

    const existingPresence = await query(
      `
        SELECT 1
        FROM admin_activity
        WHERE actor_email = $1
          AND action = 'session'
          AND entity_type = 'auth'
          AND entity_id = $2
        LIMIT 1
      `,
      [email, presenceEntityId],
    );

    if (!existingPresence.rowCount) {
      const { ipAddress, userAgent } = getClientContext(event);
      try {
        await logAdminActivity({
          action: "session",
          actorEmail: email,
          entityType: "auth",
          entityId: presenceEntityId,
          entityName: user?.name || email,
          details: {
            source: "auth-me",
            dailyPresence: true,
            ipAddress,
            userAgent,
          },
        });
      } catch {
        // Session validation should still work if usage logging fails.
      }
    }

    return json(200, { ok: true, user });
  } catch {
    return json(401, { ok: false });
  }
}
