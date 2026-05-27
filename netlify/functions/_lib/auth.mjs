import jwt from "jsonwebtoken";

export function parseCookies(cookieHeader = "") {
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

function verifySessionToken(token) {
  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  const email = String(payload?.email || "").toLowerCase();
  const allowed = getAllowedEmails();
  if (!email || !allowed.has(email)) {
    return null;
  }

  return payload;
}

export function getSessionAdmin(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const cookies = parseCookies(cookieHeader);
  return verifySessionToken(cookies.admin_session);
}

export function getClientContext(event) {
  const headers = event?.headers || {};
  const forwardedFor =
    headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "";
  const ipAddress = String(forwardedFor).split(",")[0].trim() || null;
  const userAgent =
    String(headers["user-agent"] || headers["User-Agent"] || "").trim() ||
    null;

  return { ipAddress, userAgent };
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
  // 🔹 1. Allow import secret (machine access)
  const headers = event.headers || {};
  const importSecret =
    headers["x-admin-import-secret"] || headers["X-Admin-Import-Secret"];

  if (importSecret && process.env.ADMIN_IMPORT_SECRET) {
    if (importSecret === process.env.ADMIN_IMPORT_SECRET) {
      return { email: "import@system" };
    }
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }

  // 🔹 2. Existing cookie-based admin auth
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

  const payload = verifySessionToken(token);
  if (!payload) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }

  return payload; // { email, name, picture, iat, exp }
}
