export const VENUES_TABLE = "venues260414";

export const VALID_STATUSES = new Set([
  "draft",
  "active",
  "inactive",
  "archived",
  "coming_soon",
]);

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  const out = value.map((entry) => String(entry).trim()).filter(Boolean);
  return Array.from(new Set(out));
}

export function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function normalizeLowerText(value) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizeStatus(value, fallback = "draft") {
  const normalized = normalizeLowerText(value) || fallback;
  return VALID_STATUSES.has(normalized) ? normalized : fallback;
}

export function normalizeCategory(value, categories) {
  const explicit = normalizeOptionalText(value);
  if (explicit) return explicit;

  const firstCategory = normalizeStringArray(categories)[0];
  return firstCategory || null;
}

export function normalizeInstagramForDto(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://instagram.com/${normalized.replace(/^@/, "")}`;
}

export function toVenueDto(row) {
  const category = normalizeOptionalText(row.category);

  return {
    id: row.id,
    destinationSlug: row.destination_slug,
    category,
    name: row.name,
    slug: row.slug,
    status: row.status,
    live: row.live,
    editorialTags: row.editorial_tags ?? [],
    isPassVenue: row.is_pass_venue,
    staffPick: row.staff_pick,
    isFeatured: row.is_featured,
    priorityScore: row.priority_score,
    passPriority: row.pass_priority,
    laptopFriendly: false,
    powerBackup: "unknown",
    categories: category ? [category] : [],
    emoji: [],
    stars: row.stars,
    reviews: row.reviews,
    discount: row.discount,
    excerpt: row.excerpt,
    description: row.description,
    bestFor: row.best_for ?? [],
    tags: row.tags ?? [],
    cardPerk: row.card_perk,
    offers: row.offer ?? [],
    howToClaim: row.how_to_claim,
    restrictions: row.restrictions,
    price: row.price,
    hours: row.hours,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    logo: row.logo,
    image: row.image,
    ogImage: row.og_image,
    mapUrl: row.map_url,
    googlePlaceId: row.google_place_id,
    email: row.email,
    instagram: row.instagram,
    instagramUrl: normalizeInstagramForDto(row.instagram),
    whatsapp: row.whatsapp,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    lastVerifiedAt: row.last_verified_at,
    deletedAt: row.deleted_at,
    source: row.source,
    notesInternal: row.notes_internal,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}
