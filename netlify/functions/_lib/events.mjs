import { randomUUID } from "node:crypto";
import { normalizeLowerText, normalizeOptionalText } from "./crm.mjs";

export const EVENTS_TABLE = "events";

export const EVENT_CATEGORIES = new Set([
  "wellness",
  "music",
  "surf_ocean",
  "food_drink",
  "community",
  "workshops",
  "fitness",
  "nightlife",
  "arts_culture",
  "markets",
]);

export const EVENT_RECURRING_TYPES = new Set(["daily", "weekly", "monthly"]);
export const EVENT_PRICE_TYPES = new Set(["free", "paid"]);
export const EVENT_STATUSES = new Set(["draft", "published"]);
export const EVENT_EDITOR_PRIORITIES = new Set(["low", "medium", "high"]);
export const EVENT_AUDIENCES = new Set(["tourist", "resident", "both"]);
export const EVENT_SEASONS = new Set(["high", "shoulder", "low"]);
export const EVENT_WEEKDAYS = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export function makeEventId() {
  return randomUUID();
}

export function normalizeEventId(value) {
  const normalized = normalizeLowerText(value);
  if (!normalized) return makeEventId();
  if (!/^[a-z0-9][a-z0-9_-]{2,80}$/.test(normalized)) {
    const err = new Error("event id is invalid");
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeEventDate(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const err = new Error("eventDate must use YYYY-MM-DD format");
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeOptionalEventDate(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  return normalizeEventDate(normalized);
}

export function normalizeEventTime(value, fieldName, required = true) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    if (!required) return null;
    const err = new Error(`${fieldName} must use HH:mm or HH:mm:ss format`);
    err.statusCode = 400;
    throw err;
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    const err = new Error(`${fieldName} must use HH:mm or HH:mm:ss format`);
    err.statusCode = 400;
    throw err;
  }

  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

export function normalizeRequiredEventText(value, fieldName) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeEventActive(value) {
  return typeof value === "boolean" ? value : true;
}

export function normalizeEventBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeEventEnum(value, allowed, fallback, fieldName) {
  const normalized = normalizeLowerText(value) || fallback;
  if (!allowed.has(normalized)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeEventWeekday(value, fallback = null) {
  const normalized = normalizeOptionalText(value) || fallback;
  if (!normalized) return null;
  if (!EVENT_WEEKDAYS.has(normalized)) {
    const err = new Error("dayOfWeek must be a weekday");
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeEventTags(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim());

  return Array.from(
    new Set(values.map((item) => normalizeOptionalText(item)).filter(Boolean)),
  );
}

export function normalizeEventImageUrls(value, fallbackUrl = null) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim());

  const normalized = Array.from(
    new Set(values.map((item) => normalizeOptionalText(item)).filter(Boolean)),
  );

  const fallback = normalizeOptionalText(fallbackUrl);
  if (fallback && !normalized.includes(fallback)) normalized.unshift(fallback);

  return normalized;
}

export function normalizeEventTextArray(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split("\n")
        .map((item) => item.trim());

  return Array.from(
    new Set(values.map((item) => normalizeOptionalText(item)).filter(Boolean)),
  );
}

export function normalizeOptionalEventObject(value, allowedKeys = null) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("JSON object field is invalid");
    err.statusCode = 400;
    throw err;
  }

  const entries = Object.entries(value)
    .filter(([key]) => !allowedKeys || allowedKeys.includes(key))
    .map(([key, item]) => [key, normalizeOptionalText(item)])
    .filter(([, item]) => Boolean(item));

  return entries.length ? Object.fromEntries(entries) : null;
}

export function normalizeEventObject(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("rawEvent must be a JSON object");
    err.statusCode = 400;
    throw err;
  }
  return value;
}

export function normalizeOptionalEventNumber(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const err = new Error(`${fieldName} must be a number`);
    err.statusCode = 400;
    throw err;
  }
  return numeric;
}

export function normalizeIntelligenceScore(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
    const err = new Error(
      "intelligenceScore must be an integer between 0 and 100",
    );
    err.statusCode = 400;
    throw err;
  }
  return numeric;
}

export function normalizeEventOrder(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isInteger(numeric)) {
    const err = new Error("eventOrder must be an integer");
    err.statusCode = 400;
    throw err;
  }
  return numeric;
}

export function normalizeEventSearch(value) {
  return normalizeLowerText(value) || "";
}

function formatDateInColombo(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function toEventDto(row) {
  const startDate = row.day_key || formatDateInColombo(row.start_date);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    venueId: row.venue_id,
    venueName: row.venue_name,
    venueInstagram: row.venue_instagram,
    venueGoogleUrl: row.venue_google_url,
    venueLat: row.venue_lat,
    venueLng: row.venue_lng,
    directionsUrl: row.directions_url,
    instagramUrl: row.instagram_url,
    startDate,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    dayKey: row.day_key || startDate,
    weekday: row.weekday,
    dayNumber: row.day_number,
    month: row.month,
    displayTime: row.display_time,
    recurring: row.recurring,
    recurringType: row.recurring_type,
    dayOfWeek: row.day_of_week,
    priceType: row.price_type,
    price: row.price,
    bookingUrl: row.booking_url,
    whatsappNumber: row.whatsapp_number,
    imageUrl: row.image_url,
    imageUrls: row.image_urls ?? (row.image_url ? [row.image_url] : []),
    mobileImageUrl: row.mobile_image_url,
    offerImageUrl: row.offer_image_url,
    offerText: row.offer_text,
    details: row.details ?? [],
    venueLinks: row.venue_links ?? [],
    passBenefit: row.pass_benefit,
    eventOrder: row.event_order ?? 0,
    sourceKey: row.source_key,
    rawEvent: row.raw_event,
    tags: row.tags ?? [],
    featured: row.featured,
    editorialPick: row.editorial_pick,
    status: row.status,
    source: row.source,
    lastVerifiedAt: row.last_verified_at,
    intelligenceScore: row.intelligence_score,
    editorPriority: row.editor_priority,
    editorNotes: row.editor_notes,
    audience: row.audience,
    season: row.season,
    featuredThisWeek: row.featured_this_week,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
