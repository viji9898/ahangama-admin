import { createHash } from "node:crypto";
import {
  VALID_INTERACTION_OUTCOMES,
  VALID_INTERACTION_TYPES,
  normalizeLowerText,
  normalizeOptionalText,
} from "./crm.mjs";

export const TRAVEL_AGENT_COMPANIES_TABLE = "travel_agent_companies";
export const TRAVEL_AGENT_CONTACTS_TABLE = "travel_agent_contacts";
export const TRAVEL_AGENT_INTERACTIONS_TABLE = "travel_agent_interactions";

function slugify(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || fallback;
}

export function normalizeTravelAgentInteractionType(value) {
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

export function normalizeTravelAgentInteractionOutcome(value, fallback = "pending") {
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

export function makeTravelAgentCompanyId(companyName = "") {
  const safeCompanyName = slugify(companyName, "company");
  const hash = createHash("sha1")
    .update(String(companyName || "").trim().toLowerCase())
    .digest("hex")
    .slice(0, 10);
  return `${safeCompanyName}-${hash}`;
}

export function makeTravelAgentContactId(companyId, fullName = "") {
  const safeCompanyId = slugify(companyId, "company");
  const safeFullName = slugify(fullName, "contact");
  const hash = createHash("sha1")
    .update(`${safeCompanyId}:${String(fullName || "").trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 10);
  return `${safeCompanyId}-${safeFullName}-${hash}`;
}

export function makeTravelAgentInteractionId(companyId, contactId, interactionType) {
  const now = Date.now().toString(36);
  return `${slugify(companyId, "company")}-${slugify(contactId, "contact")}-${interactionType}-${now}`;
}

export function normalizeTravelAgentCompanyName(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    const err = new Error("companyName is required");
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function normalizeTravelAgentFullName(value, fallback = null) {
  const normalized = normalizeOptionalText(value) || fallback;
  if (!normalized) {
    const err = new Error("fullName is required");
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

export function toTravelAgentCompanyDto(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    notes: row.notes,
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTravelAgentContactDto(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name ?? null,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    phone: row.phone,
    notes: row.notes,
    emailSent: row.email_sent,
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTravelAgentInteractionDto(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name ?? null,
    contactId: row.contact_id,
    contactName: row.full_name ?? null,
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