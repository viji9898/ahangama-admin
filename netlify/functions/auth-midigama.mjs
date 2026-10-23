import { getMidigamaUser } from "./_lib/midigamaAuth.mjs";
import { modernHandler } from "./_lib/modernHandler.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const access = getMidigamaUser(event);
  if (!access.user) return json(access.statusCode, { ok: false });

  return json(200, { ok: true });
}

export default modernHandler(handler);