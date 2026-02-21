import "dotenv/config";
import { PLACES } from "./placesTemp.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:8888";
const CREATE_ENDPOINT = `${BASE_URL}/.netlify/functions/api-venues-create`;
const SECRET = (process.env.ADMIN_IMPORT_SECRET || "").trim();

const LIMIT = Number(process.env.IMPORT_LIMIT || 0);

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return [];
}

function normalizeVenue(place) {
  const categories = Array.isArray(place.categories)
    ? place.categories
    : place.category
      ? [place.category]
      : [];

  return {
    id: String(place.id || place.slug || "")
      .trim()
      .toLowerCase(),
    destinationSlug: String(place.destinationSlug || "")
      .trim()
      .toLowerCase(),
    name: String(place.name || "").trim(),
    slug: String(place.slug || "")
      .trim()
      .toLowerCase(),
    status: String(place.status || "active").toLowerCase(),

    categories: categories.map(String).filter(Boolean),
    emoji: asStringArray(place.emoji),

    stars: toNumberOrNull(place.stars),
    reviews: place.reviews ?? null,
    discount: toNumberOrNull(place.discount),

    excerpt: place.excerpt ?? null,
    description: place.description ?? null,

    bestFor: asStringArray(place.bestFor),
    tags: asStringArray(place.tags),

    cardPerk: place.cardPerk ?? null,
    offers: Array.isArray(place.offers)
      ? place.offers
      : Array.isArray(place.offer)
        ? place.offer
        : [],

    howToClaim: place.howToClaim ?? null,
    restrictions: place.restrictions ?? null,
    area: place.area ?? null,

    lat: toNumberOrNull(place.lat),
    lng: toNumberOrNull(place.lng),

    logo: place.logo ?? null,
    image: place.image ?? null,
    ogImage: place.ogImage ?? null,
    mapUrl: place.mapUrl ?? null,
    instagramUrl: place.instagramUrl ?? null,
    whatsapp: place.whatsapp ?? null,
  };
}

async function requestJson(url, body) {
  if (!SECRET) throw new Error("Missing ADMIN_IMPORT_SECRET");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-import-secret": SECRET,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore JSON parse error
  }

  return { res, data, text };
}

export async function importTempVenues() {
  const insertedIds = [];
  const updatedIds = [];
  const skippedMissing = [];
  const skippedDuplicate = [];
  const failed = []; // { id, status, error }

  const places = LIMIT > 0 ? PLACES.slice(0, LIMIT) : PLACES;
  const seen = new Set();

  for (const place of places) {
    const venue = normalizeVenue(place);
    const vid = venue.id || venue.slug || "(unknown)";

    // 1) Missing required fields
    if (!venue.id || !venue.destinationSlug || !venue.name || !venue.slug) {
      skippedMissing.push({
        id: vid,
        reason: "missing required fields",
        destinationSlug: venue.destinationSlug,
        slug: venue.slug,
        name: venue.name,
      });
      console.log(`⏭️ Skipped (missing fields) ${vid}`);
      continue;
    }

    // 2) Duplicate in the import file
    const key = `${venue.destinationSlug}:${venue.id}`;
    if (seen.has(key)) {
      skippedDuplicate.push({
        id: venue.id,
        destinationSlug: venue.destinationSlug,
      });
      console.log(`⏭️ Skipped (duplicate in file) ${venue.id}`);
      continue;
    }
    seen.add(key);

    // 3) Create/Upsert
    try {
      const { res, data, text } = await requestJson(CREATE_ENDPOINT, venue);

      if (!res.ok) {
        failed.push({
          id: venue.id,
          status: res.status,
          error: data?.error || text,
        });
        console.log(`❌ Failed ${venue.id}: ${res.status}`);
        continue;
      }

      // Requires your API to return { inserted: true/false }
      if (data?.inserted === true) {
        insertedIds.push(venue.id);
        console.log(`✅ Inserted ${venue.id}`);
      } else {
        updatedIds.push(venue.id);
        console.log(`♻️ Updated ${venue.id}`);
      }
    } catch (e) {
      failed.push({
        id: venue.id,
        status: "ERR",
        error: e?.message || String(e),
      });
      console.log(`❌ Error ${venue.id}:`, e?.message || e);
    }
  }

  console.log("\n==========================");
  console.log("📊 Import Summary (Detailed)");
  console.log("--------------------------");
  console.log(`Total input:         ${places.length}`);
  console.log(`Inserted:            ${insertedIds.length}`);
  console.log(`Updated:             ${updatedIds.length}`);
  console.log(`Skipped (missing):   ${skippedMissing.length}`);
  console.log(`Skipped (duplicate): ${skippedDuplicate.length}`);
  console.log(`Failed:              ${failed.length}`);
  console.log("==========================\n");

  if (insertedIds.length)
    console.log("✅ Inserted IDs:", insertedIds.join(", "));
  if (updatedIds.length) console.log("♻️ Updated IDs:", updatedIds.join(", "));
  if (skippedMissing.length) console.log("⏭️ Skipped missing:", skippedMissing);
  if (skippedDuplicate.length)
    console.log(
      "⏭️ Skipped duplicates:",
      skippedDuplicate.map((x) => x.id).join(", "),
    );
  if (failed.length) console.log("❌ Failed:", failed);
}

importTempVenues();
