import { getSessionAdmin } from "./_lib/auth.mjs";
import { modernHandler } from "./_lib/modernHandler.mjs";

const MIDIGAMA_EMAIL = "viji@viji.com";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const user = getSessionAdmin(event);
  if (!user) return json(401, { ok: false });

  const email = String(user.email || "").trim().toLowerCase();
  if (email !== MIDIGAMA_EMAIL) {
    return json(403, { ok: false });
  }

  return json(200, { ok: true });
}

export default modernHandler(handler);