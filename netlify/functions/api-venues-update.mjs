import { requireAdmin } from "./_lib/auth.mjs";
import { diffFields, logAdminActivity } from "./_lib/adminActivity.mjs";
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

const VENUE_ACTIVITY_FIELDS = {
  destination_slug: "destination",
  category: "category",
  name: "name",
  slug: "slug",
  status: "status",
  live: "live",
  editorial_tags: "editorial tags",
  is_pass_venue: "pass venue",
  circle: "circle",
  circle_perk: "circle perk",
  staff_pick: "staff pick",
  is_featured: "featured",
  priority_score: "priority score",
  pass_priority: "pass priority",
  stars: "stars",
  reviews: "reviews",
  discount: "discount",
  excerpt: "excerpt",
  description: "description",
  best_for: "best for",
  tags: "tags",
  card_perk: "card perk",
  offer: "offers",
  how_to_claim: "how to claim",
  restrictions: "restrictions",
  price: "price",
  hours: "hours",
  area: "area",
  lat: "latitude",
  lng: "longitude",
  logo: "logo",
  image: "image",
  og_image: "og image",
  map_url: "map url",
  google_place_id: "google place id",
  email: "email",
  instagram: "instagram",
  whatsapp: "whatsapp",
  last_verified_at: "last verified at",
  source: "source",
  notes_internal: "internal notes",
  deleted_at: "deleted at",
};

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

    const beforeResult = await query(
      `
        SELECT *
        FROM ${VENUES_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id],
    );
    if (beforeResult.rowCount === 0) {
      return json(404, { ok: false, error: "Venue not found" });
    }
    const beforeRow = beforeResult.rows[0];

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
        circle           = COALESCE($10::boolean, circle),
        circle_perk      = COALESCE($11, circle_perk),
        staff_pick       = COALESCE($12::boolean, staff_pick),
        is_featured      = COALESCE($13::boolean, is_featured),
        priority_score   = COALESCE($14::numeric, priority_score),
        pass_priority    = COALESCE($15::numeric, pass_priority),

        stars            = COALESCE($16::numeric, stars),
        reviews          = COALESCE($17::int, reviews),
        discount         = COALESCE($18::numeric, discount),

        excerpt          = COALESCE($19, excerpt),
        description      = COALESCE($20, description),

        best_for         = COALESCE($21::text[], best_for),
        tags             = COALESCE($22::text[], tags),

        card_perk        = COALESCE($23, card_perk),
        offer            = COALESCE($24::jsonb, offer),

        how_to_claim     = COALESCE($25, how_to_claim),
        restrictions     = COALESCE($26, restrictions),

        price            = COALESCE($27, price),
        hours            = COALESCE($28, hours),
        area             = COALESCE($29, area),
        lat              = COALESCE($30::double precision, lat),
        lng              = COALESCE($31::double precision, lng),

        logo             = COALESCE($32, logo),
        image            = COALESCE($33, image),
        og_image         = COALESCE($34, og_image),

        map_url          = COALESCE($35, map_url),
        google_place_id  = COALESCE($36, google_place_id),
        email            = COALESCE($37, email),
        instagram        = COALESCE($38, instagram),
        whatsapp         = COALESCE($39, whatsapp),
        updated_by       = COALESCE($40, updated_by),
        last_verified_at = COALESCE($41::timestamptz, last_verified_at),
        source           = COALESCE($42, source),
        notes_internal   = COALESCE($43, notes_internal),
        deleted_at       = COALESCE($44::timestamptz, deleted_at)

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
      has("circle") ? Boolean(body.circle) : null,
      has("circlePerk") ? (body.circlePerk ?? null) : null,
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

      const row = r.rows[0];
      const changedFields = diffFields(beforeRow, row, VENUE_ACTIVITY_FIELDS);

      await logAdminActivity({
        action: "update",
        actorEmail: actor?.email,
        entityType: "venue",
        entityId: row.id,
        entityName: row.name,
        venueId: row.id,
        changedFields,
      });

      return json(200, { ok: true, venue: toVenueDto(row) });
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
