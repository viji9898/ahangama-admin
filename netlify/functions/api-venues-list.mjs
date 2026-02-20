import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // optional CORS if you ever call from another domain:
    // "Access-Control-Allow-Origin": "*",
  },
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
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    // Auth gate (cookie + allowlist)
    requireAdmin(event);

    const qs = event.queryStringParameters || {};
    const destinationSlug = (qs.destinationSlug || "ahangama")
      .trim()
      .toLowerCase();
    const q = (qs.q || "").trim().toLowerCase();
    const category = (qs.category || "").trim().toLowerCase();

    const where = ["destination_slug = $1"];
    const params = [destinationSlug];
    let idx = 2;

    if (q) {
      where.push(
        `(lower(name) LIKE $${idx}
          OR lower(coalesce(excerpt,'')) LIKE $${idx}
          OR lower(coalesce(card_perk,'')) LIKE $${idx}
          OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) LIKE $${idx})
        )`,
      );
      params.push(`%${q}%`);
      idx++;
    }

    if (category) {
      where.push(`$${idx} = ANY(categories)`);
      params.push(category);
      idx++;
    }

    const sql = `
      SELECT
        id, destination_slug, name, slug, status,
        categories, emoji,
        stars, reviews, discount,
        excerpt, description,
        best_for, tags,
        card_perk, offers,
        how_to_claim, restrictions,
        area, lat, lng,
        logo, image, og_image,
        map_url, instagram_url, whatsapp,
        updated_at, created_at
      FROM venues
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at DESC
      LIMIT 500
    `;

    const r = await query(sql, params);
    return json(200, { ok: true, venues: r.rows.map(toVenueDto) });
  } catch (e) {
    const statusCode = e?.statusCode || 500;
    return json(statusCode, { ok: false, error: String(e?.message || e) });
  }
}
