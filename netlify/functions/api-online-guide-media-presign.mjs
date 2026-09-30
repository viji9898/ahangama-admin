import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";

const BUCKET = "customer-apps-techhq";
const PREFIX = "ahangama-online-guide";
const REGION =
  (process.env.S3_REGION || process.env.AWS_REGION || "").trim() || "eu-west-2";
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
const USE_ACL_PUBLIC_READ = /^(1|true|yes)$/i.test(
  String(process.env.S3_USE_ACL_PUBLIC_READ || "").trim(),
);
const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const slug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const publicUrlForKey = (key) =>
  `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const venueId = slug(body.venueId);
    const description = String(body.description || "").trim();
    const descriptionSlug = slug(description);
    const contentType = String(body.contentType || "").trim().toLowerCase();
    const extension = EXTENSIONS.get(contentType);

    if (!descriptionSlug) {
      return json(400, { ok: false, error: "Description is required" });
    }
    if (!extension) {
      return json(400, {
        ok: false,
        error: "Only JPG, PNG, and WebP images are allowed",
      });
    }

    if (venueId) {
      const venue = await query(
        "SELECT id FROM venues260414 WHERE id = $1 AND deleted_at IS NULL",
        [venueId],
      );
      if (!venue.rows[0]) {
        return json(400, { ok: false, error: "Selected venue was not found" });
      }
    }

    const id = randomUUID();
    const filename = `${venueId || "general"}-${descriptionSlug}-${id.slice(0, 8)}.${extension}`;
    const key = `${PREFIX}/${filename}`;
    const fields = {
      key,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(USE_ACL_PUBLIC_READ ? { acl: "public-read" } : {}),
    };
    const conditions = [
      ["content-length-range", 1, MAX_BYTES],
      { "Content-Type": contentType },
      { "Cache-Control": "public, max-age=31536000, immutable" },
      ...(USE_ACL_PUBLIC_READ ? [{ acl: "public-read" }] : []),
    ];
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
        id,
        url: presigned.url,
        fields: presigned.fields,
        bucket: BUCKET,
        key,
        publicUrl: publicUrlForKey(key),
        contentType,
        maxBytes: MAX_BYTES,
      },
    });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export default modernHandler(handler);