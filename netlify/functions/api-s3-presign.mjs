import { requireAdmin } from "./_lib/auth.mjs";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const BUCKET = (process.env.S3_BUCKET || "").trim();
const REGION =
  (process.env.S3_REGION || process.env.AWS_REGION || "").trim() || "us-east-1";
const PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || "").trim();

// Netlify reserves AWS_* env vars in the UI. Prefer S3_* variables.
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

const maxBytesForKind = (kind) => {
  switch (kind) {
    case "logo":
      return 50 * 1024;
    case "image":
    case "ogImage":
      return 100 * 1024;
    default:
      return null;
  }
};

const keyFor = (venueId, kind) => {
  const safeId = String(venueId || "")
    .trim()
    .toLowerCase();
  if (!safeId) return null;
  if (kind === "logo") return `venues/${safeId}/logo.jpg`;
  if (kind === "image") return `venues/${safeId}/image.jpg`;
  if (kind === "ogImage") return `venues/${safeId}/og.jpg`;
  return null;
};

const publicUrlForKey = (key) => {
  if (!key) return "";
  if (PUBLIC_BASE_URL) {
    return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  // Virtual-hosted–style. Note: for us-east-1 the endpoint also commonly works without region.
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
      return json(500, {
        ok: false,
        error: "Missing S3_BUCKET env var",
      });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const venueId = String(body.id || "")
      .trim()
      .toLowerCase();
    const kind = String(body.kind || "").trim();

    if (!venueId) return json(400, { ok: false, error: "id is required" });

    const maxBytes = maxBytesForKind(kind);
    const key = keyFor(venueId, kind);
    if (!maxBytes || !key) {
      return json(400, { ok: false, error: "Invalid kind" });
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

    const fields = {
      key,
      "Content-Type": "image/jpeg",
      ...(USE_ACL_PUBLIC_READ ? { acl: "public-read" } : {}),
    };

    const conditions = [
      ["content-length-range", 1, maxBytes],
      { "Content-Type": "image/jpeg" },
      ...(USE_ACL_PUBLIC_READ ? [{ acl: "public-read" }] : []),
    ];

    const presigned = await createPresignedPost(s3, {
      Bucket: BUCKET,
      Key: key,
      Fields: fields,
      Conditions: conditions,
      Expires: 60,
    });

    return json(200, {
      ok: true,
      upload: {
        url: presigned.url,
        fields: presigned.fields,
        key,
        publicUrl: publicUrlForKey(key),
        maxBytes,
        contentType: "image/jpeg",
      },
    });
  } catch (e) {
    return json(e.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
