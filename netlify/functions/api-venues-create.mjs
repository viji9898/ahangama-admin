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

function badRequest(message) {
  return json(400, { ok: false, error: message });
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }

    const destinationSlug = String(body.destinationSlug || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "")
      .trim()
      .toLowerCase();
    const id = String(body.id || slug)
      .trim()
      .toLowerCase(); // id defaults to slug

    if (!destinationSlug) return badRequest("destinationSlug is required");
    if (!name) return badRequest("name is required");
    if (!slug) return badRequest("slug is required");

    const status = String(body.status || "active").toLowerCase();

    const categories = Array.isArray(body.categories)
      ? body.categories.map(String)
      : [];

    const emoji = Array.isArray(body.emoji) ? body.emoji.map(String) : [];

    const bestFor = Array.isArray(body.bestFor) ? body.bestFor.map(String) : [];

    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

    const offers = Array.isArray(body.offers) ? body.offers : [];

    const sql = `
      INSERT INTO venues (
        id, destination_slug, name, slug, status,
        categories, emoji,
        stars, reviews, discount,
        excerpt, description,
        best_for, tags,
        card_perk, offers,
        how_to_claim, restrictions,
        area, lat, lng,
        logo, image, og_image,
        map_url, instagram_url, whatsapp
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,
        $8,$9,$10,
        $11,$12,
        $13,$14,
        $15,$16::jsonb,
        $17,$18,
        $19,$20,$21,
        $22,$23,$24,
        $25,$26,$27
      )
      RETURNING *;
    `;

    const params = [
      id,
      destinationSlug,
      name,
      slug,
      status,

      categories,
      emoji,

      body.stars ?? null,
      body.reviews ?? null,
      body.discount ?? null,

      body.excerpt ?? null,
      body.description ?? null,

      bestFor,
      tags,

      body.cardPerk ?? null,
      JSON.stringify(offers),

      body.howToClaim ?? null,
      body.restrictions ?? null,

      body.area ?? null,
      body.lat ?? null,
      body.lng ?? null,

      body.logo ?? null,
      body.image ?? null,
      body.ogImage ?? null,

      body.mapUrl ?? null,
      body.instagramUrl ?? null,
      body.whatsapp ?? null,
    ];

    try {
      const r = await query(sql, params);
      return json(200, { ok: true, venue: toVenueDto(r.rows[0]) });
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.toLowerCase().includes("duplicate key")) {
        return json(409, { ok: false, error: "Venue already exists" });
      }
      throw e;
    }
  } catch (e) {
    const statusCode = e?.statusCode || 500;
    return json(statusCode, { ok: false, error: String(e?.message || e) });
  }
}
