import { getSessionAdmin } from "./auth.mjs";

const MIDIGAMA_EMAIL = "viji@viji.com";

export function getMidigamaUser(event) {
  const user = getSessionAdmin(event);
  if (!user) return { statusCode: 401, user: null };

  const email = String(user.email || "").trim().toLowerCase();
  if (email !== MIDIGAMA_EMAIL) {
    return { statusCode: 403, user: null };
  }

  return { statusCode: 200, user };
}