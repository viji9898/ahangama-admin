import type { Venue } from "../../types/venue";

export type VenueFilterKey = "all" | "live" | "coming-soon" | "staff-pick";

export const VENUE_CATEGORY_OPTIONS = [
  { label: "Eat", value: "eat" },
  { label: "Stays", value: "stays" },
  { label: "Wellness", value: "wellness" },
  { label: "Co-Working", value: "co-working" },
  { label: "Experiences", value: "experiences" },
  { label: "Retail", value: "retail" },
  { label: "Surf", value: "surf" },
  { label: "Transport", value: "transport" },
];

export const VENUE_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Archived", value: "archived" },
  { label: "Coming Soon", value: "coming_soon" },
];

export function normalizeId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = value.map((item) => normalizeText(item)).filter(Boolean);
  return Array.from(new Set(out));
}

export function formatDateTime(value: unknown) {
  if (!value) return "—";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getVenueCategories(venue?: Venue) {
  const out = [
    ...normalizeStringArray(venue?.category ? [venue.category] : []),
    ...normalizeStringArray(venue?.categories),
  ];
  return Array.from(new Set(out));
}

export function getVenuePrimaryCategory(venue?: Venue) {
  return getVenueCategories(venue)[0] || "";
}

export function getVenueHeroImage(venue?: Venue) {
  return venue?.image || venue?.ogImage || venue?.logo || "";
}

export function getVenueOffersArray(offers: unknown): string[] {
  if (Array.isArray(offers)) {
    return offers.map((item) => normalizeText(item)).filter(Boolean);
  }
  if (typeof offers === "string") {
    return offers
      .split(/\r?\n|,/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

export function listToText(value: unknown) {
  return normalizeStringArray(value).join("\n");
}

export function textToList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getVenueInstagramValue(venue?: Venue) {
  return normalizeText(venue?.instagram || venue?.instagramUrl);
}

export function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toNullableInteger(value: unknown) {
  const number = toNullableNumber(value);
  return number === null ? null : Math.trunc(number);
}
