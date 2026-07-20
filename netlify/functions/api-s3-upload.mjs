import { randomUUID } from "node:crypto";
import { requireAdmin } from "./_lib/auth.mjs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const BUCKET = (process.env.S3_BUCKET || "").trim();
const REGION =
  (process.env.S3_REGION || process.env.AWS_REGION || "").trim() || "eu-west-2";
const PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || "").trim();
const ACCESS_KEY_ID = (
  process.env.S3_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  ""
).trim();
const SECRET_ACCESS_KEY = (
  process.env.S3_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  ""
).trim();

const USE_ACL_PUBLIC_READ = String(process.env.S3_USE_ACL_PUBLIC_READ || "")
  .trim()
  .toLowerCase()
  .match(/^(1|true|yes)$/);

const CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const maxBytesForKind = (kind) => {
  switch (kind) {
    case "eventImage":
      return 500 * 1024;
    default:
      return null;
  }
};

const keyFor = (id, kind, contentType) => {
  const safeId = String(id || "")
    .trim()
    .toLowerCase();
  const extension = CONTENT_TYPES.get(contentType);
  if (!safeId || !extension) return null;
  if (kind === "eventImage") return `events/${safeId}/${randomUUID()}.${extension}`;
  return null;
};

const publicUrlForKey = (key) => {
  if (!key) return "";
  if (PUBLIC_BASE_URL) {
    const base = PUBLIC_BASE_URL.replace(/\/$/, "");
    const publicKey =
      key.startsWith("app-ahangama-demo/") &&
      base.endsWith("/app-ahangama-demo")
        ? key.replace(/^app-ahangama-demo\//, "")
        : key;
    return `${base}/${publicKey}`;
  }

  const base =
    REGION === "us-east-1"
      ? `https://${BUCKET}.s3.amazonaws.com`
      : `https://${BUCKET}.s3.${REGION}.amazonaws.com`;
  return `${base}/${key}`;
};

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    if (!BUCKET) {
      return json(500, { ok: false, error: "Missing S3_BUCKET env var" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const id = String(body.id || "").trim().toLowerCase();
    const kind = String(body.kind || "").trim();
    const contentType = String(body.contentType || "").trim().toLowerCase();
    const dataBase64 = String(body.dataBase64 || "").trim();

    if (!id) return json(400, { ok: false, error: "id is required" });
    if (!CONTENT_TYPES.has(contentType)) {
      return json(400, {
        ok: false,
        error: "Only JPG, PNG, and WebP images are allowed.",
      });
    }
    if (!dataBase64) {
      return json(400, { ok: false, error: "Image data is required" });
    }

    const maxBytes = maxBytesForKind(kind);
    const key = keyFor(id, kind, contentType);
    if (!maxBytes || !key) {
      return json(400, { ok: false, error: "Invalid kind" });
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (!buffer.length) {
      return json(400, { ok: false, error: "Image data is invalid" });
    }
    if (buffer.length > maxBytes) {
      return json(400, {
        ok: false,
        error: `Event images must be <= ${Math.round(maxBytes / 1024)}KB.`,
      });
    }

    const s3 = new S3Client({
      region: REGION,
      ...(ACCESS_KEY_ID && SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: ACCESS_KEY_ID,
              secretAccessKey: SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
        ...(USE_ACL_PUBLIC_READ ? { ACL: "public-read" } : {}),
      }),
    );

    return json(200, {
      ok: true,
      upload: {
        key,
        publicUrl: publicUrlForKey(key),
        maxBytes,
        contentType,
      },
    });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
