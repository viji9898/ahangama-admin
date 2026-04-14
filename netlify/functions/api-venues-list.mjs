import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import { VENUES_TABLE, toVenueDto } from "./_lib/venues260414.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // optional CORS if you ever call from another domain:
    // "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

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
      where.push(`lower(category) = $${idx}`);
      params.push(category);
      idx++;
    }

    const sql = `
      SELECT
        id, destination_slug, category, name, slug, status,
        live,
        editorial_tags, is_pass_venue, staff_pick, is_featured, priority_score, pass_priority,
        stars, reviews, discount,
        excerpt, description,
        best_for, tags,
        card_perk, offer,
        how_to_claim, restrictions,
        price, hours, area, lat, lng,
        logo, image, og_image,
        map_url, google_place_id, email, instagram, whatsapp,
        created_by, updated_by, last_verified_at, deleted_at, source, notes_internal,
        updated_at, created_at
      FROM ${VENUES_TABLE}
      WHERE ${where.join(" AND ")} AND deleted_at IS NULL
      ORDER BY is_featured DESC, priority_score DESC, pass_priority DESC, staff_pick DESC, stars DESC NULLS LAST
      LIMIT 500
    `;

    const r = await query(sql, params);
    return json(200, { ok: true, venues: r.rows.map(toVenueDto) });
  } catch (e) {
    const statusCode = e?.statusCode || 500;
    return json(statusCode, { ok: false, error: String(e?.message || e) });
  }
}
