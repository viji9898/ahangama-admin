function normalizeLinkType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized === "directions" ? "google_maps" : normalized;
}

function normalizeDestination(value, type) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  const urlValue =
    type === "instagram" && !/^https?:\/\//i.test(rawValue)
      ? `https://instagram.com/${rawValue.replace(/^@/, "")}`
      : rawValue;

  try {
    const url = new URL(urlValue);
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${url.pathname
      .replace(/\/$/, "")
      .toLowerCase()}`;
  } catch {
    return "";
  }
}

export function reconcileVenueLinkTypes(
  customLinkTypes = [],
  automaticClicks = [],
  venue = {},
) {
  const counts = new Map();

  for (const item of customLinkTypes) {
    const label = normalizeLinkType(item.label);
    if (label) counts.set(label, (counts.get(label) || 0) + Number(item.value || 0));
  }

  const destinations = {
    website: venue.website,
    instagram: venue.instagramUrl || venue.instagram,
    google_maps: venue.mapUrl,
  };

  for (const [label, destination] of Object.entries(destinations)) {
    const normalizedDestination = normalizeDestination(destination, label);
    if (!normalizedDestination) continue;

    const automaticCount = automaticClicks.reduce((total, item) => {
      return normalizeDestination(item.url, label) === normalizedDestination
        ? total + Number(item.value || 0)
        : total;
    }, 0);

    counts.set(label, Math.max(counts.get(label) || 0, automaticCount));
  }

  return [...counts]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
}

export function reconcileVenueOutboundClicks(
  customLinkTypes = [],
  customTotal = 0,
  automaticClicks = [],
  venue = {},
) {
  const linkTypes = reconcileVenueLinkTypes(
    customLinkTypes,
    automaticClicks,
    venue,
  );
  const classifiedTotal = linkTypes.reduce(
    (total, item) => total + Number(item.value || 0),
    0,
  );
  const engagements = Math.max(Number(customTotal || 0), classifiedTotal);
  const unclassified = engagements - classifiedTotal;

  if (unclassified > 0) {
    linkTypes.push({ label: "unclassified", value: unclassified });
    linkTypes.sort((left, right) => right.value - left.value);
  }

  return { engagements, linkTypes };
}