import { getMidigamaUser } from "./_lib/midigamaAuth.mjs";
import { modernHandler } from "./_lib/modernHandler.mjs";

const SITE = { latitude: 5.966889, longitude: 80.391139 };
const SEARCH_RADIUS_METERS = 5000;
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
].join(",");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=3600",
  },
  body: JSON.stringify(body),
});

function distanceMeters(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitude - SITE.latitude);
  const longitudeDelta = toRadians(longitude - SITE.longitude);
  const originLatitude = toRadians(SITE.latitude);
  const destinationLatitude = toRadians(latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.sqrt(haversine));
}

function normalizePlace(place) {
  const distance = distanceMeters(place.location);
  return {
    id: place.id,
    name: place.displayName?.text || "Unnamed place",
    type: place.primaryTypeDisplayName?.text || "Place",
    address: place.formattedAddress || "",
    latitude: Number(place.location?.latitude),
    longitude: Number(place.location?.longitude),
    distanceMeters: distance === null ? null : Math.round(distance),
    rating: Number.isFinite(place.rating) ? place.rating : null,
    reviewCount: Number.isFinite(place.userRatingCount)
      ? place.userRatingCount
      : null,
    mapsUrl: place.googleMapsUri || null,
    websiteUrl: place.websiteUri || null,
  };
}

async function searchPlaces(apiKey, textQuery) {
  const response = await fetch(PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 20,
      languageCode: "en",
      locationBias: {
        circle: {
          center: SITE,
          radius: SEARCH_RADIUS_METERS,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google Places failed (${response.status})`);
  }

  return (Array.isArray(payload.places) ? payload.places : [])
    .map(normalizePlace)
    .filter(
      (place) =>
        place.distanceMeters !== null &&
        place.distanceMeters <= SEARCH_RADIUS_METERS,
    )
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const access = getMidigamaUser(event);
  if (!access.user) {
    return json(access.statusCode, {
      error: access.statusCode === 401 ? "Unauthenticated" : "Forbidden",
    });
  }

  const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!apiKey) {
    return json(503, { error: "GOOGLE_PLACES_API_KEY is not configured" });
  }

  try {
    const [accommodation, demandDrivers] = await Promise.all([
      searchPlaces(apiKey, "hotels villas and guest houses near Midigama Sri Lanka"),
      searchPlaces(apiKey, "surf beaches cafes restaurants and attractions near Midigama Sri Lanka"),
    ]);

    return json(200, {
      generatedAt: new Date().toISOString(),
      site: SITE,
      searchRadiusMeters: SEARCH_RADIUS_METERS,
      accommodation,
      demandDrivers,
    });
  } catch (error) {
    return json(502, { error: String(error?.message || error) });
  }
}

export default modernHandler(handler);