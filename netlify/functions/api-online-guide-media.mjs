import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";

const BUCKET = "customer-apps-techhq";
const PREFIX = "ahangama-online-guide/";
const REGION =
  (process.env.S3_REGION || process.env.AWS_REGION || "").trim() || "eu-west-2";
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const publicUrlForKey = (key) =>
  `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

const slug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const toMedia = (row) => ({
  id: row.id,
  venueId: row.venue_id,
  venueName: row.venue_name,
  description: row.description,
  originalFilename: row.original_filename,
  key: row.s3_key,
  url: row.public_url,
  contentType: row.content_type,
  sizeBytes: row.size_bytes,
  width: row.width,
  height: row.height,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
});

async function listMedia(event) {
  const q = String(event.queryStringParameters?.q || "").trim().toLowerCase();
  const venueId = String(event.queryStringParameters?.venueId || "")
    .trim()
    .toLowerCase();
  const params = [];
  const where = [];

  if (venueId) {
    params.push(venueId);
    where.push(`media.venue_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(media.description) LIKE $${params.length}
      OR lower(media.original_filename) LIKE $${params.length}
      OR lower(media.s3_key) LIKE $${params.length}
      OR lower(coalesce(venue.name, '')) LIKE $${params.length}
    )`);
  }

  const result = await query(
    `
      SELECT media.*, venue.name AS venue_name
      FROM online_guide_media AS media
      LEFT JOIN venues260414 AS venue ON venue.id = media.venue_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY media.created_at DESC
      LIMIT 250
    `,
    params,
  );

  return json(200, { ok: true, media: result.rows.map(toMedia) });
}

async function createMedia(event, actor) {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const id = String(body.id || "").trim().toLowerCase();
  const venueId = String(body.venueId || "").trim().toLowerCase() || null;
  const description = String(body.description || "").trim();
  const originalFilename = String(body.originalFilename || "").trim();
  const key = String(body.key || "").trim();
  const contentType = String(body.contentType || "").trim().toLowerCase();
  const sizeBytes = Number(body.sizeBytes || 0);
  const width = Number(body.width || 0) || null;
  const height = Number(body.height || 0) || null;
  const expectedKeyPrefix = `${PREFIX}${venueId || "general"}-${slug(description)}-`;

  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return json(400, { ok: false, error: "Invalid upload id" });
  }
  if (!description || !originalFilename) {
    return json(400, {
      ok: false,
      error: "Description and original filename are required",
    });
  }
  if (
    !key.startsWith(expectedKeyPrefix) ||
    !key.includes(`-${id.slice(0, 8)}.`) ||
    !CONTENT_TYPES.has(contentType)
  ) {
    return json(400, { ok: false, error: "Invalid uploaded object metadata" });
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10 * 1024 * 1024) {
    return json(400, { ok: false, error: "Invalid image size" });
  }

  const result = await query(
    `
      INSERT INTO online_guide_media (
        id, venue_id, description, original_filename, s3_bucket, s3_key,
        public_url, content_type, size_bytes, width, height, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      id,
      venueId,
      description,
      originalFilename,
      BUCKET,
      key,
      publicUrlForKey(key),
      contentType,
      sizeBytes,
      width,
      height,
      String(actor?.email || "").toLowerCase() || null,
    ],
  );

  const row = result.rows[0];
  return json(201, {
    ok: true,
    media: toMedia({ ...row, venue_name: null }),
  });
}

async function handler(event) {
  try {
    const actor = requireAdmin(event);
    if (event.httpMethod === "GET") return listMedia(event);
    if (event.httpMethod === "POST") return createMedia(event, actor);
    return json(405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export default modernHandler(handler);