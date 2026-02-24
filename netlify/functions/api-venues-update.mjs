import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const ALLOWED_POWER_BACKUP = new Set([
  "generator",
  "inverter",
  "none",
  "unknown",
]);

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  const out = value.map((s) => String(s).trim()).filter(Boolean);
  return Array.from(new Set(out));
};

function toVenueDto(row) {
  return {
    id: row.id,
    destinationSlug: row.destination_slug,
    name: row.name,
    slug: row.slug,
    status: row.status,
    live: row.live,
    editorialTags: row.editorial_tags ?? [],
    isPassVenue: row.is_pass_venue,
    staffPick: row.staff_pick,
    priorityScore: row.priority_score,
    laptopFriendly: row.laptop_friendly,
    powerBackup: row.power_backup,
    categories: row.categories ?? [],
    emoji: row.emoji ?? [],
    stars: row.stars,
    reviews: row.reviews,
    discount: row.discount,
    excerpt: row.excerpt,
    description: row.description,
    bestFor: row.best_for ?? [],
    tags: row.tags ?? [],
    cardPerk: row.card_perk,
    offers: row.offers ?? [],
    howToClaim: row.how_to_claim,
    restrictions: row.restrictions,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    logo: row.logo,
    image: row.image,
    ogImage: row.og_image,
    mapUrl: row.map_url,
    instagramUrl: row.instagram_url,
    whatsapp: row.whatsapp,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "PUT" && event.httpMethod !== "PATCH") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const id = String(body.id || "")
      .trim()
      .toLowerCase();
    if (!id) return json(400, { ok: false, error: "id is required" });

    // Helper to support PATCH while allowing explicit nulls
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    if (has("powerBackup")) {
      const v = String(body.powerBackup ?? "")
        .trim()
        .toLowerCase();
      if (!ALLOWED_POWER_BACKUP.has(v)) {
        return json(400, {
          ok: false,
          error:
            'powerBackup must be one of ["generator", "inverter", "none", "unknown"]',
        });
      }
    }

    if (has("priorityScore")) {
      const raw = body.priorityScore;
      if (raw === null) {
        return json(400, { ok: false, error: "priorityScore cannot be null" });
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        return json(400, {
          ok: false,
          error: "priorityScore must be a number",
        });
      }
      if (n < 0) {
        return json(400, { ok: false, error: "priorityScore must be >= 0" });
      }
    }

    const sql = `
      UPDATE venues
      SET
        destination_slug = COALESCE($2, destination_slug),
        name             = COALESCE($3, name),
        slug             = COALESCE($4, slug),
        status           = COALESCE($5, status),

        live             = COALESCE($6::boolean, live),

        editorial_tags   = COALESCE($7::text[], editorial_tags),
        is_pass_venue    = COALESCE($8::boolean, is_pass_venue),
        staff_pick       = COALESCE($9::boolean, staff_pick),
        priority_score   = COALESCE($10::numeric, priority_score),
        laptop_friendly  = COALESCE($11::boolean, laptop_friendly),
        power_backup     = COALESCE($12::varchar, power_backup),

        categories       = COALESCE($13::text[], categories),
        emoji            = COALESCE($14::text[], emoji),

        stars            = COALESCE($15::numeric, stars),
        reviews          = COALESCE($16::int, reviews),
        discount         = COALESCE($17::numeric, discount),

        excerpt          = COALESCE($18, excerpt),
        description      = COALESCE($19, description),

        best_for         = COALESCE($20::text[], best_for),
        tags             = COALESCE($21::text[], tags),

        card_perk        = COALESCE($22, card_perk),
        offers           = COALESCE($23::jsonb, offers),

        how_to_claim     = COALESCE($24, how_to_claim),
        restrictions     = COALESCE($25, restrictions),

        area             = COALESCE($26, area),
        lat              = COALESCE($27::double precision, lat),
        lng              = COALESCE($28::double precision, lng),

        logo             = COALESCE($29, logo),
        image            = COALESCE($30, image),
        og_image         = COALESCE($31, og_image),

        map_url          = COALESCE($32, map_url),
        instagram_url    = COALESCE($33, instagram_url),
        whatsapp         = COALESCE($34, whatsapp)

      WHERE id = $1
      RETURNING *;
    `;

    // For PATCH: only send value if present; otherwise send null -> COALESCE keeps existing.
    // For PUT: you can send all fields; missing fields remain unchanged.
    const params = [
      id,

      has("destinationSlug")
        ? String(body.destinationSlug).trim().toLowerCase()
        : null,
      has("name") ? String(body.name).trim() : null,
      has("slug") ? String(body.slug).trim().toLowerCase() : null,
      has("status") ? String(body.status).trim().toLowerCase() : null,

      has("live") ? Boolean(body.live) : null,

      has("editorialTags") ? normalizeStringArray(body.editorialTags) : null,
      has("isPassVenue") ? Boolean(body.isPassVenue) : null,
      has("staffPick") ? Boolean(body.staffPick) : null,
      has("priorityScore") ? Number(body.priorityScore) : null,
      has("laptopFriendly") ? Boolean(body.laptopFriendly) : null,
      has("powerBackup") ? String(body.powerBackup).trim().toLowerCase() : null,

      has("categories") ? normalizeStringArray(body.categories) : null,
      has("emoji") ? normalizeStringArray(body.emoji) : null,

      has("stars") ? (body.stars ?? null) : null,
      has("reviews") ? (body.reviews ?? null) : null,
      has("discount") ? (body.discount ?? null) : null,

      has("excerpt") ? (body.excerpt ?? null) : null,
      has("description") ? (body.description ?? null) : null,

      has("bestFor") ? normalizeStringArray(body.bestFor) : null,
      has("tags") ? normalizeStringArray(body.tags) : null,

      has("cardPerk") ? (body.cardPerk ?? null) : null,
      has("offers")
        ? JSON.stringify(Array.isArray(body.offers) ? body.offers : [])
        : null,

      has("howToClaim") ? (body.howToClaim ?? null) : null,
      has("restrictions") ? (body.restrictions ?? null) : null,

      has("area") ? (body.area ?? null) : null,
      has("lat") ? (body.lat ?? null) : null,
      has("lng") ? (body.lng ?? null) : null,

      has("logo") ? (body.logo ?? null) : null,
      has("image") ? (body.image ?? null) : null,
      has("ogImage") ? (body.ogImage ?? null) : null,

      has("mapUrl") ? (body.mapUrl ?? null) : null,
      has("instagramUrl") ? (body.instagramUrl ?? null) : null,
      has("whatsapp") ? (body.whatsapp ?? null) : null,
    ];

    try {
      const r = await query(sql, params);
      if (r.rowCount === 0)
        return json(404, { ok: false, error: "Venue not found" });
      return json(200, { ok: true, venue: toVenueDto(r.rows[0]) });
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.toLowerCase().includes("duplicate")) {
        // could be primary key conflict or unique (destination_slug, slug)
        return json(409, { ok: false, error: "Duplicate venue id or slug" });
      }
      throw e;
    }
  } catch (e) {
    return json(e.statusCode || 500, {
      ok: false,
      error: String(e.message || e),
    });
  }
}
