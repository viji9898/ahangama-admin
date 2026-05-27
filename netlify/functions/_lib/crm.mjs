import { createHash } from "node:crypto";

export const PARTNER_CONTACTS_TABLE = "partner_contacts";
export const PARTNER_TOUCHPOINT_INVENTORY_TABLE = "partner_touchpoint_inventory";
export const PARTNER_INTERACTIONS_TABLE = "partner_interactions";

export const VALID_CONTACT_ROLES = new Set(["owner", "manager", "other"]);
export const VALID_TOUCHPOINT_TYPES = new Set([
  "qr_stand",
  "postcard_stand",
  "tea_tin",
  "tote_bag",
  "other",
]);
export const VALID_INTERACTION_TYPES = new Set([
  "call",
  "whatsapp",
  "email",
  "visit",
  "feedback",
]);
export const VALID_INTERACTION_OUTCOMES = new Set([
  "pending",
  "successful",
  "no_response",
  "not_interested",
]);

export function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();
  return normalized ? normalized : null;
}

export function normalizeLowerText(value) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizeReferenceKey(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  const upper = normalized.toUpperCase();
  if (!/^[A-Z0-9]+$/.test(upper)) {
    const err = new Error(
      "referenceKey must use uppercase letters and numbers only",
    );
    err.statusCode = 400;
    throw err;
  }

  return upper;
}

export function normalizeContactRole(value, fallback = "other") {
  const normalized = normalizeLowerText(value) || fallback;
  if (!VALID_CONTACT_ROLES.has(normalized)) {
    const err = new Error("role must be one of owner, manager, other");
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeTouchpointType(value) {
  const normalized = normalizeLowerText(value);
  if (!normalized || !VALID_TOUCHPOINT_TYPES.has(normalized)) {
    const err = new Error(
      "touchpointType must be one of qr_stand, postcard_stand, tea_tin, tote_bag, other",
    );
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeQuantity(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    const err = new Error("quantity must be an integer >= 0");
    err.statusCode = 400;
    throw err;
  }
  return numeric;
}

export function normalizeInteractionType(value) {
  const normalized = normalizeLowerText(value);
  if (!normalized || !VALID_INTERACTION_TYPES.has(normalized)) {
    const err = new Error(
      "interactionType must be one of call, whatsapp, email, visit, feedback",
    );
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeInteractionOutcome(value, fallback = "pending") {
  const normalized = normalizeLowerText(value) || fallback;
  if (!VALID_INTERACTION_OUTCOMES.has(normalized)) {
    const err = new Error(
      "outcomeStatus must be one of pending, successful, no_response, not_interested",
    );
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function makePartnerContactId(venueId, role, contactName = "") {
  const safeVenueId = String(venueId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
  const safeRole = String(role || "other")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 16);
  const safeContactName = String(contactName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const hash = createHash("sha1")
    .update(`${safeVenueId}:${safeRole}:${safeContactName || "contact"}`)
    .digest("hex")
    .slice(0, 10);

  return `${safeVenueId || "venue"}-${safeRole || "other"}-${safeContactName || "contact"}-${hash}`;
}

export function makeInteractionId(venueId, interactionType) {
  const now = Date.now().toString(36);
  const safeVenueId = String(venueId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
  return `${safeVenueId || "venue"}-${interactionType}-${now}`;
}

export function toPartnerContactDto(row) {
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venue_name ?? null,
    contactName: row.contact_name,
    role: row.role,
    email: row.email,
    whatsapp: row.whatsapp,
    phone: row.phone,
    notes: row.notes,
    isPrimary: row.is_primary,
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTouchpointInventoryDto(row) {
  return {
    venueId: row.venue_id,
    venueName: row.venue_name ?? null,
    touchpointType: row.touchpoint_type,
    quantity: row.quantity,
    notes: row.notes,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPartnerInteractionDto(row) {
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venue_name ?? null,
    contactId: row.contact_id,
    contactName: row.contact_name ?? null,
    interactionType: row.interaction_type,
    outcomeStatus: row.outcome_status,
    summary: row.summary,
    feedback: row.feedback,
    nextAction: row.next_action,
    nextFollowUpAt: row.next_follow_up_at,
    interactionAt: row.interaction_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
