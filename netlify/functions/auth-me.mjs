import jwt from "jsonwebtoken";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf("=");
        return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      }),
  );
}

export async function handler(event) {
  const cookies = parseCookies(event.headers.cookie || "");
  const token = cookies.admin_session;
  if (!token) return json(401, { ok: false });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return json(200, { ok: true, user });
  } catch {
    return json(401, { ok: false });
  }
}
