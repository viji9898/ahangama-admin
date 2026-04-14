import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  VENUES_TABLE,
  normalizeCategory,
  normalizeLowerText,
  normalizeOptionalText,
  normalizeStatus,
  normalizeStringArray,
  toVenueDto,
} from "./_lib/venues260414.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function badRequest(message) {
  return json(400, { ok: false, error: message });
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }

    const destinationSlug = normalizeLowerText(body.destinationSlug);
    const category = normalizeCategory(body.category, body.categories);
    const name = normalizeOptionalText(body.name);
    const slug = normalizeLowerText(body.slug);
    const id = normalizeLowerText(body.id || slug);

    if (!destinationSlug) return badRequest("destinationSlug is required");
    if (!name) return badRequest("name is required");
    if (!slug) return badRequest("slug is required");
    if (!category) return badRequest("category is required");

    const status = normalizeStatus(body.status, "draft");
    const live =
      typeof body.live === "boolean" ? body.live : status === "active";

    const editorialTags = normalizeStringArray(body.editorialTags);
    const isPassVenue =
      typeof body.isPassVenue === "boolean" ? body.isPassVenue : false;
    const staffPick =
      typeof body.staffPick === "boolean" ? body.staffPick : false;
    const isFeatured =
      typeof body.isFeatured === "boolean" ? body.isFeatured : false;

    let priorityScore = 0;
    if (
      body.priorityScore !== undefined &&
      body.priorityScore !== null &&
      body.priorityScore !== ""
    ) {
      const n = Number(body.priorityScore);
      if (!Number.isFinite(n))
        return badRequest("priorityScore must be a number");
      if (n < 0) return badRequest("priorityScore must be >= 0");
      priorityScore = n;
    }

    let passPriority = 0;
    if (
      body.passPriority !== undefined &&
      body.passPriority !== null &&
      body.passPriority !== ""
    ) {
      const n = Number(body.passPriority);
      if (!Number.isFinite(n))
        return badRequest("passPriority must be a number");
      if (n < 0) return badRequest("passPriority must be >= 0");
      passPriority = n;
    }

    const bestFor = normalizeStringArray(body.bestFor);
    const tags = normalizeStringArray(body.tags);
    const offers = Array.isArray(body.offers)
      ? body.offers
      : Array.isArray(body.offer)
        ? body.offer
        : [];

    const createdBy = normalizeOptionalText(actor?.email);
    const updatedBy = normalizeOptionalText(actor?.email);

    const sql = `
      INSERT INTO ${VENUES_TABLE} (
        id, destination_slug, category, name, slug, status,
        stars, reviews, excerpt, description,
        best_for, tags, editorial_tags, card_perk, offer,
        how_to_claim, restrictions, discount, price, hours, area,
        lat, lng, map_url, google_place_id,
        whatsapp, email, instagram,
        logo, image, og_image,
        live, is_pass_venue, staff_pick, is_featured, priority_score, pass_priority,
        created_by, updated_by, source, notes_internal, deleted_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,$15::jsonb,
        $16,$17,$18,$19,$20,$21,
        $22,$23,$24,$25,
        $26,$27,$28,
        $29,$30,$31,
        $32,$33,$34,$35,$36,$37,
        $38,$39,$40,$41,NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        destination_slug = EXCLUDED.destination_slug,
        category = EXCLUDED.category,
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        status = EXCLUDED.status,
        stars = EXCLUDED.stars,
        reviews = EXCLUDED.reviews,
        excerpt = EXCLUDED.excerpt,
        description = EXCLUDED.description,
        best_for = EXCLUDED.best_for,
        tags = EXCLUDED.tags,
        editorial_tags = EXCLUDED.editorial_tags,
        card_perk = EXCLUDED.card_perk,
        offer = EXCLUDED.offer,
        how_to_claim = EXCLUDED.how_to_claim,
        restrictions = EXCLUDED.restrictions,
        discount = EXCLUDED.discount,
        price = EXCLUDED.price,
        hours = EXCLUDED.hours,
        area = EXCLUDED.area,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        map_url = EXCLUDED.map_url,
        google_place_id = EXCLUDED.google_place_id,
        whatsapp = EXCLUDED.whatsapp,
        email = EXCLUDED.email,
        instagram = EXCLUDED.instagram,
        logo = EXCLUDED.logo,
        image = EXCLUDED.image,
        og_image = EXCLUDED.og_image,
        live = EXCLUDED.live,
        is_pass_venue = EXCLUDED.is_pass_venue,
        staff_pick = EXCLUDED.staff_pick,
        is_featured = EXCLUDED.is_featured,
        priority_score = EXCLUDED.priority_score,
        pass_priority = EXCLUDED.pass_priority,
        updated_by = EXCLUDED.updated_by,
        source = EXCLUDED.source,
        notes_internal = EXCLUDED.notes_internal,
        deleted_at = NULL
      RETURNING *, (xmax = 0) AS inserted;
    `;

    const params = [
      id,
      destinationSlug,
      category,
      name,
      slug,
      status,
      body.stars ?? null,
      body.reviews ?? null,
      body.excerpt ?? null,
      body.description ?? null,
      bestFor,
      tags,
      editorialTags,
      body.cardPerk ?? null,
      JSON.stringify(offers),
      body.howToClaim ?? null,
      body.restrictions ?? null,
      body.discount ?? null,
      body.price ?? null,
      body.hours ?? null,
      body.area ?? null,
      body.lat ?? null,
      body.lng ?? null,
      body.mapUrl ?? null,
      body.googlePlaceId ?? null,
      body.whatsapp ?? null,
      body.email ?? null,
      body.instagram ?? body.instagramUrl ?? null,
      body.logo ?? null,
      body.image ?? null,
      body.ogImage ?? null,
      live,
      isPassVenue,
      staffPick,
      isFeatured,
      priorityScore,
      passPriority,
      createdBy,
      updatedBy,
      body.source ?? "admin-crud",
      body.notesInternal ?? null,
    ];

    const r = await query(sql, params);
    const row = r.rows[0];
    const inserted = !!row.inserted;
    return json(200, { ok: true, inserted, venue: toVenueDto(row) });
  } catch (e) {
    const statusCode = e?.statusCode || 500;
    return json(statusCode, { ok: false, error: String(e?.message || e) });
  }
}
