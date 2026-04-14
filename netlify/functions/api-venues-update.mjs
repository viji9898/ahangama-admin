import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  VENUES_TABLE,
  VALID_STATUSES,
  normalizeCategory,
  normalizeLowerText,
  normalizeStringArray,
  toVenueDto,
} from "./_lib/venues260414.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "PUT" && event.httpMethod !== "PATCH") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

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

    if (has("passPriority")) {
      const raw = body.passPriority;
      if (raw === null) {
        return json(400, { ok: false, error: "passPriority cannot be null" });
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        return json(400, { ok: false, error: "passPriority must be a number" });
      }
      if (n < 0) {
        return json(400, { ok: false, error: "passPriority must be >= 0" });
      }
    }

    if (has("status")) {
      const nextStatus = String(body.status || "")
        .trim()
        .toLowerCase();
      if (!VALID_STATUSES.has(nextStatus)) {
        return json(400, { ok: false, error: "Invalid status" });
      }
    }

    const category =
      has("category") || has("categories")
        ? normalizeCategory(body.category, body.categories)
        : null;
    if ((has("category") || has("categories")) && !category) {
      return json(400, { ok: false, error: "category is required" });
    }

    const sql = `
      UPDATE ${VENUES_TABLE}
      SET
        destination_slug = COALESCE($2, destination_slug),
        category         = COALESCE($3, category),
        name             = COALESCE($4, name),
        slug             = COALESCE($5, slug),
        status           = COALESCE($6, status),

        live             = COALESCE($7::boolean, live),

        editorial_tags   = COALESCE($8::text[], editorial_tags),
        is_pass_venue    = COALESCE($9::boolean, is_pass_venue),
        staff_pick       = COALESCE($10::boolean, staff_pick),
        is_featured      = COALESCE($11::boolean, is_featured),
        priority_score   = COALESCE($12::numeric, priority_score),
        pass_priority    = COALESCE($13::numeric, pass_priority),

        stars            = COALESCE($14::numeric, stars),
        reviews          = COALESCE($15::int, reviews),
        discount         = COALESCE($16::numeric, discount),

        excerpt          = COALESCE($17, excerpt),
        description      = COALESCE($18, description),

        best_for         = COALESCE($19::text[], best_for),
        tags             = COALESCE($20::text[], tags),

        card_perk        = COALESCE($21, card_perk),
        offer            = COALESCE($22::jsonb, offer),

        how_to_claim     = COALESCE($23, how_to_claim),
        restrictions     = COALESCE($24, restrictions),

        price            = COALESCE($25, price),
        hours            = COALESCE($26, hours),
        area             = COALESCE($27, area),
        lat              = COALESCE($28::double precision, lat),
        lng              = COALESCE($29::double precision, lng),

        logo             = COALESCE($30, logo),
        image            = COALESCE($31, image),
        og_image         = COALESCE($32, og_image),

        map_url          = COALESCE($33, map_url),
        google_place_id  = COALESCE($34, google_place_id),
        email            = COALESCE($35, email),
        instagram        = COALESCE($36, instagram),
        whatsapp         = COALESCE($37, whatsapp),
        updated_by       = COALESCE($38, updated_by),
        last_verified_at = COALESCE($39::timestamptz, last_verified_at),
        source           = COALESCE($40, source),
        notes_internal   = COALESCE($41, notes_internal),
        deleted_at       = COALESCE($42::timestamptz, deleted_at)

      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING *;
    `;

    // For PATCH: only send value if present; otherwise send null -> COALESCE keeps existing.
    // For PUT: you can send all fields; missing fields remain unchanged.
    const params = [
      id,

      has("destinationSlug")
        ? String(body.destinationSlug).trim().toLowerCase()
        : null,
      category,
      has("name") ? String(body.name).trim() : null,
      has("slug") ? normalizeLowerText(body.slug) : null,
      has("status") ? normalizeLowerText(body.status) : null,

      has("live") ? Boolean(body.live) : null,

      has("editorialTags") ? normalizeStringArray(body.editorialTags) : null,
      has("isPassVenue") ? Boolean(body.isPassVenue) : null,
      has("staffPick") ? Boolean(body.staffPick) : null,
      has("isFeatured") ? Boolean(body.isFeatured) : null,
      has("priorityScore") ? Number(body.priorityScore) : null,
      has("passPriority") ? Number(body.passPriority) : null,

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
        : has("offer")
          ? JSON.stringify(Array.isArray(body.offer) ? body.offer : [])
          : null,

      has("howToClaim") ? (body.howToClaim ?? null) : null,
      has("restrictions") ? (body.restrictions ?? null) : null,

      has("price") ? (body.price ?? null) : null,
      has("hours") ? (body.hours ?? null) : null,
      has("area") ? (body.area ?? null) : null,
      has("lat") ? (body.lat ?? null) : null,
      has("lng") ? (body.lng ?? null) : null,

      has("logo") ? (body.logo ?? null) : null,
      has("image") ? (body.image ?? null) : null,
      has("ogImage") ? (body.ogImage ?? null) : null,

      has("mapUrl") ? (body.mapUrl ?? null) : null,
      has("googlePlaceId") ? (body.googlePlaceId ?? null) : null,
      has("email") ? (body.email ?? null) : null,
      has("instagram")
        ? (body.instagram ?? null)
        : has("instagramUrl")
          ? (body.instagramUrl ?? null)
          : null,
      has("whatsapp") ? (body.whatsapp ?? null) : null,
      actor?.email ? String(actor.email).trim().toLowerCase() : null,
      has("lastVerifiedAt") ? (body.lastVerifiedAt ?? null) : null,
      has("source") ? (body.source ?? null) : null,
      has("notesInternal") ? (body.notesInternal ?? null) : null,
      has("deletedAt") ? (body.deletedAt ?? null) : null,
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
