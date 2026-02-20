import jwt from "jsonwebtoken";

function parseCookies(cookieHeader = "") {
  // "a=1; b=2" -> {a:"1", b:"2"}
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf("=");
        if (idx === -1) return [pair, ""];
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        return [k, decodeURIComponent(v)];
      }),
  );
}

function getAllowedEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function requireAdmin(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const cookies = parseCookies(cookieHeader);

  const token = cookies.admin_session;
  if (!token) {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("Missing env var: JWT_SECRET");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }

  const email = String(payload?.email || "").toLowerCase();
  const allowed = getAllowedEmails();
  if (!email || !allowed.has(email)) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }

  return payload; // { email, name, picture, iat, exp }
}
