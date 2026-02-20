import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function toVenueDto(row) {
  return {
    id: row.id,
    destinationSlug: row.destination_slug,
    name: row.name,
    slug: row.slug,
    status: row.status,
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

    const sql = `
      UPDATE venues
      SET
        destination_slug = COALESCE($2, destination_slug),
        name             = COALESCE($3, name),
        slug             = COALESCE($4, slug),
        status           = COALESCE($5, status),

        categories       = COALESCE($6::text[], categories),
        emoji            = COALESCE($7::text[], emoji),

        stars            = COALESCE($8::numeric, stars),
        reviews          = COALESCE($9::int, reviews),
        discount         = COALESCE($10::numeric, discount),

        excerpt          = COALESCE($11, excerpt),
        description      = COALESCE($12, description),

        best_for         = COALESCE($13::text[], best_for),
        tags             = COALESCE($14::text[], tags),

        card_perk        = COALESCE($15, card_perk),
        offers           = COALESCE($16::jsonb, offers),

        how_to_claim     = COALESCE($17, how_to_claim),
        restrictions     = COALESCE($18, restrictions),

        area             = COALESCE($19, area),
        lat              = COALESCE($20::double precision, lat),
        lng              = COALESCE($21::double precision, lng),

        logo             = COALESCE($22, logo),
        image            = COALESCE($23, image),
        og_image         = COALESCE($24, og_image),

        map_url          = COALESCE($25, map_url),
        instagram_url    = COALESCE($26, instagram_url),
        whatsapp         = COALESCE($27, whatsapp)

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

      has("categories")
        ? Array.isArray(body.categories)
          ? body.categories.map(String)
          : []
        : null,
      has("emoji")
        ? Array.isArray(body.emoji)
          ? body.emoji.map(String)
          : []
        : null,

      has("stars") ? (body.stars ?? null) : null,
      has("reviews") ? (body.reviews ?? null) : null,
      has("discount") ? (body.discount ?? null) : null,

      has("excerpt") ? (body.excerpt ?? null) : null,
      has("description") ? (body.description ?? null) : null,

      has("bestFor")
        ? Array.isArray(body.bestFor)
          ? body.bestFor.map(String)
          : []
        : null,
      has("tags")
        ? Array.isArray(body.tags)
          ? body.tags.map(String)
          : []
        : null,

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
