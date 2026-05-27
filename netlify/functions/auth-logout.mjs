import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { getClientContext, getSessionAdmin } from "./_lib/auth.mjs";

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export async function handler(event) {
  const user = getSessionAdmin(event);

  if (user?.email) {
    try {
      const { ipAddress, userAgent } = getClientContext(event);
      await logAdminActivity({
        action: "logout",
        actorEmail: user.email,
        entityType: "auth",
        entityId: `logout:${String(user.email).toLowerCase()}:${Date.now()}`,
        entityName: user?.name || user.email,
        details: {
          source: "logout",
          ipAddress,
          userAgent,
        },
      });
    } catch {
      // Logout should still clear the cookie if audit logging fails.
    }
  }

  const cookie = [
    "admin_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
  return json(200, { ok: true }, { "Set-Cookie": cookie });
}
