import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const allowedEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204 };
  if (event.httpMethod !== "POST")
    return json(405, { error: "Method not allowed" });

  try {
    const { idToken } = JSON.parse(event.body || "{}");
    if (!idToken) return json(400, { error: "Missing idToken" });

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const p = ticket.getPayload();
    const email = (p?.email || "").toLowerCase();

    if (!email || !allowedEmails.has(email)) {
      return json(403, { error: "Not authorized" });
    }

    const sessionToken = jwt.sign(
      { email, name: p?.name || null, picture: p?.picture || null },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const isProd = process.env.NODE_ENV === "production";

    const cookie = [
      `admin_session=${sessionToken}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${7 * 24 * 60 * 60}`,
      isProd ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    return json(200, { ok: true }, { "Set-Cookie": cookie });
  } catch {
    return json(401, { error: "Invalid Google token" });
  }
}
