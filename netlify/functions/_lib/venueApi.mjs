function getBaseUrl() {
  const value =
    process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL;
  if (!value) throw new Error("Missing Netlify site URL for venues API");
  return value.replace(/\/$/, "");
}

export async function getVenueFromApi(
  identifier,
  { fetchImpl = fetch, baseUrl = getBaseUrl() } = {},
) {
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  if (!normalizedIdentifier) throw new Error("Missing venue identifier");

  const importSecret = String(process.env.ADMIN_IMPORT_SECRET || "").trim();
  if (!importSecret) throw new Error("Missing env var: ADMIN_IMPORT_SECRET");

  const url = new URL("/.netlify/functions/api-venues-list", baseUrl);
  url.searchParams.set("identifier", normalizedIdentifier);

  const response = await fetchImpl(url, {
    headers: { "x-admin-import-secret": importSecret },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Venues API request failed (${response.status})`);
  }

  return (
    (payload.venues || []).find((venue) =>
      [venue.id, venue.slug, venue.name].some(
        (value) => String(value || "").trim().toLowerCase() === normalizedIdentifier,
      ),
    ) || null
  );
}