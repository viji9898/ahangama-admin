import { query } from "./db.mjs";

const memoryCache = new Map();
const MAX_GEOCODES_PER_REQUEST = 25;

async function readDatabaseCache(keys) {
  if (!keys.length) return [];
  const result = await query(
    `SELECT location_key, latitude, longitude, status
       FROM ga_geography_coordinate_cache
      WHERE location_key = ANY($1::text[])`,
    [keys],
  );
  return result.rows;
}

async function writeDatabaseCache(location, coordinates) {
  await query(
    `INSERT INTO ga_geography_coordinate_cache
       (location_key, city, region, country, latitude, longitude, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (location_key) DO UPDATE SET
       city = EXCLUDED.city,
       region = EXCLUDED.region,
       country = EXCLUDED.country,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [
      location.key,
      location.city,
      location.region,
      location.country,
      coordinates?.lat ?? null,
      coordinates?.lng ?? null,
      coordinates ? "resolved" : "not_found",
    ],
  );
}

async function geocodeLocation(location, apiKey) {
  const address = [location.city, location.region, location.country]
    .filter((value) => value && !value.startsWith("Unknown "))
    .join(", ");
  const params = new URLSearchParams({ address, key: apiKey });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    { signal: AbortSignal.timeout(8000) },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === "REQUEST_DENIED") {
    const error = new Error(
      payload?.error_message || `Geocoding request failed (${response.status})`,
    );
    error.geocodingStatus = payload.status || String(response.status);
    throw error;
  }
  const point = payload?.results?.[0]?.geometry?.location;
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) return null;
  return { lat: Number(point.lat), lng: Number(point.lng) };
}

async function mapWithConcurrency(values, concurrency, callback) {
  const output = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        output[index] = await callback(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return output;
}

export async function attachGeographyCoordinates(locations) {
  const results = new Map();
  const keys = locations.map((location) => location.key);
  let persistentCacheAvailable = true;
  let geocodingError = "";

  for (const key of keys) {
    if (memoryCache.has(key)) results.set(key, memoryCache.get(key));
  }

  const uncachedKeys = keys.filter((key) => !results.has(key));
  try {
    for (const row of await readDatabaseCache(uncachedKeys)) {
      const coordinates =
        row.status === "resolved"
          ? { lat: Number(row.latitude), lng: Number(row.longitude) }
          : null;
      results.set(row.location_key, coordinates);
      memoryCache.set(row.location_key, coordinates);
    }
  } catch {
    persistentCacheAvailable = false;
  }

  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const missing = locations.filter((location) => !results.has(location.key));
  if (apiKey) {
    await mapWithConcurrency(
      missing.slice(0, MAX_GEOCODES_PER_REQUEST),
      4,
      async (location) => {
      let coordinates = null;
      try {
        coordinates = await geocodeLocation(location, apiKey);
      } catch (error) {
        geocodingError = String(error?.message || error);
        return;
      }
      results.set(location.key, coordinates);
      memoryCache.set(location.key, coordinates);
      if (persistentCacheAvailable) {
        await writeDatabaseCache(location, coordinates).catch(() => {
          persistentCacheAvailable = false;
        });
      }
      },
    );
  }

  return {
    locations: locations
      .map((location) => ({ ...location, ...results.get(location.key) }))
      .filter(
        (location) =>
          Number.isFinite(location.lat) && Number.isFinite(location.lng),
      ),
    geocodingConfigured: Boolean(apiKey),
    geocodingError,
    persistentCacheAvailable,
    unresolvedLocationCount: locations.filter(
      (location) => !results.get(location.key),
    ).length,
  };
}