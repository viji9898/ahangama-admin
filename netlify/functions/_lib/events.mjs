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

export function makeEventId() {
  return randomUUID();
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

export function normalizeIntelligenceScore(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
    const err = new Error("intelligenceScore must be an integer between 0 and 100");
    err.statusCode = 400;
    throw err;
  }
  return numeric;
}

export function normalizeEventSearch(value) {
  return normalizeLowerText(value) || "";
}

export function toEventDto(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    venueId: row.venue_id,
    venueName: row.venue_name,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    recurring: row.recurring,
    recurringType: row.recurring_type,
    dayOfWeek: row.day_of_week,
    priceType: row.price_type,
    price: row.price,
    bookingUrl: row.booking_url,
    whatsappNumber: row.whatsapp_number,
    imageUrl: row.image_url,
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