import { query } from "./_lib/db.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { getClientContext, getSessionAdmin } from "./_lib/auth.mjs";
import { modernHandler } from "./_lib/modernHandler.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function handler(event) {
  const user = getSessionAdmin(event);
  if (!user) return json(401, { ok: false });

  const email = String(user?.email || "").toLowerCase();
  const dateKey = new Date().toISOString().slice(0, 10);
  const presenceEntityId = `presence:${dateKey}:${email}`;

  try {
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
    }
  } catch {
    // Session validation must not depend on optional activity logging.
  }

  return json(200, { ok: true, user });
}

export default modernHandler(handler);
