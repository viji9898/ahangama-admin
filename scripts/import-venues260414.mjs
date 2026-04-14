import "dotenv/config";
import pg from "pg";
import { PLACES } from "../src/data/places20260414.js";

const { Pool } = pg;

const VALID_STATUSES = new Set([
  "draft",
  "active",
  "inactive",
  "archived",
  "coming_soon",
]);

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeSlug(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIntegerOrNull(value) {
  const number = toNumberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];

  const normalized = value.map((item) => normalizeText(item)).filter(Boolean);

  return [...new Set(normalized)];
}

function inferPassVenue(place, offer, discount) {
  if (typeof place.isPassVenue === "boolean") return place.isPassVenue;
  if (typeof place.is_pass_venue === "boolean") return place.is_pass_venue;

  return Boolean(
    discount > 0 ||
    offer.length > 0 ||
    normalizeText(place.cardPerk) ||
    normalizeText(place.howToClaim),
  );
}

function normalizePlace(place) {
  const status = normalizeSlug(place.status) || "draft";
  const safeStatus = VALID_STATUSES.has(status) ? status : "draft";
  const offer = Array.isArray(place.offer)
    ? place.offer
    : Array.isArray(place.offers)
      ? place.offers
      : [];
  const discount = toNumberOrNull(place.discount) ?? 0;

  return {
    id: normalizeSlug(place.id || place.slug),
    destination_slug: normalizeSlug(place.destinationSlug),
    category: normalizeText(place.category),
    name: normalizeText(place.name),
    slug: normalizeSlug(place.slug),
    status: safeStatus,

    stars: toNumberOrNull(place.stars),
    reviews: toIntegerOrNull(place.reviews),
    excerpt: normalizeText(place.excerpt),
    description: normalizeText(place.description),
    best_for: asStringArray(place.bestFor),
    tags: asStringArray(place.tags),
    editorial_tags: asStringArray(place.editorialTags),
    card_perk: normalizeText(place.cardPerk),
    offer: JSON.stringify(offer),
    how_to_claim: normalizeText(place.howToClaim),
    restrictions: normalizeText(place.restrictions),
    discount: toNumberOrNull(place.discount),
    price: normalizeText(place.price),
    hours: normalizeText(place.hours),
    area: normalizeText(place.area),

    lat: toNumberOrNull(place.lat),
    lng: toNumberOrNull(place.lng),
    map_url: normalizeText(place.mapUrl),
    google_place_id: normalizeText(place.googlePlaceId),

    whatsapp: normalizeText(place.whatsapp || place.whatsApp),
    email: normalizeText(place.email),
    instagram: normalizeText(place.instagram || place.instagramUrl),

    logo: normalizeText(place.logo),
    image: normalizeText(place.image),
    og_image: normalizeText(place.ogImage),

    live:
      typeof place.live === "boolean" ? place.live : safeStatus === "active",
    is_pass_venue: inferPassVenue(place, offer, discount),
    staff_pick:
      typeof place.staffPick === "boolean"
        ? place.staffPick
        : typeof place.staff_pick === "boolean"
          ? place.staff_pick
          : false,
    is_featured:
      typeof place.isFeatured === "boolean"
        ? place.isFeatured
        : typeof place.is_featured === "boolean"
          ? place.is_featured
          : false,
    priority_score: toNumberOrNull(place.priorityScore) ?? 0,
    pass_priority: toNumberOrNull(place.passPriority) ?? 0,

    created_by: "import:places20260414",
    updated_by: "import:places20260414",
    last_verified_at: null,
    deleted_at: null,
    source: "places20260414",
    notes_internal: normalizeText(place.notesInternal),
  };
}

function validateVenue(venue) {
  return Boolean(
    venue.id &&
    venue.destination_slug &&
    venue.category &&
    venue.name &&
    venue.slug,
  );
}

const UPSERT_SQL = `
  INSERT INTO venues260414 (
    id,
    destination_slug,
    category,
    name,
    slug,
    status,
    stars,
    reviews,
    excerpt,
    description,
    best_for,
    tags,
    editorial_tags,
    card_perk,
    offer,
    how_to_claim,
    restrictions,
    discount,
    price,
    hours,
    area,
    lat,
    lng,
    map_url,
    google_place_id,
    whatsapp,
    email,
    instagram,
    logo,
    image,
    og_image,
    live,
    is_pass_venue,
    staff_pick,
    is_featured,
    priority_score,
    pass_priority,
    created_by,
    updated_by,
    last_verified_at,
    deleted_at,
    source,
    notes_internal
  )
  VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb,
    $16, $17, $18, $19, $20, $21,
    $22, $23, $24, $25,
    $26, $27, $28,
    $29, $30, $31,
    $32, $33, $34, $35, $36, $37,
    $38, $39, $40, $41, $42, $43
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
    last_verified_at = EXCLUDED.last_verified_at,
    deleted_at = EXCLUDED.deleted_at,
    source = EXCLUDED.source,
    notes_internal = EXCLUDED.notes_internal
  RETURNING id;
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const seenIds = new Set();
  const inserted = [];
  const skipped = [];

  try {
    await client.query("BEGIN");

    for (const place of PLACES) {
      const venue = normalizePlace(place);
      if (!validateVenue(venue)) {
        skipped.push({
          id: venue.id || place.id || place.slug,
          reason: "missing required fields",
        });
        continue;
      }

      if (seenIds.has(venue.id)) {
        skipped.push({ id: venue.id, reason: "duplicate id in source file" });
        continue;
      }
      seenIds.add(venue.id);

      await client.query(UPSERT_SQL, [
        venue.id,
        venue.destination_slug,
        venue.category,
        venue.name,
        venue.slug,
        venue.status,
        venue.stars,
        venue.reviews,
        venue.excerpt,
        venue.description,
        venue.best_for,
        venue.tags,
        venue.editorial_tags,
        venue.card_perk,
        venue.offer,
        venue.how_to_claim,
        venue.restrictions,
        venue.discount,
        venue.price,
        venue.hours,
        venue.area,
        venue.lat,
        venue.lng,
        venue.map_url,
        venue.google_place_id,
        venue.whatsapp,
        venue.email,
        venue.instagram,
        venue.logo,
        venue.image,
        venue.og_image,
        venue.live,
        venue.is_pass_venue,
        venue.staff_pick,
        venue.is_featured,
        venue.priority_score,
        venue.pass_priority,
        venue.created_by,
        venue.updated_by,
        venue.last_verified_at,
        venue.deleted_at,
        venue.source,
        venue.notes_internal,
      ]);

      inserted.push(venue.id);
    }

    await client.query("COMMIT");

    const countResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM venues260414",
    );

    console.log(`Imported/upserted ${inserted.length} rows into venues260414.`);
    console.log(`venues260414 row count: ${countResult.rows[0]?.count ?? 0}`);

    if (skipped.length > 0) {
      console.log("Skipped rows:", skipped);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Import failed:", error?.message || error);
  process.exit(1);
});
