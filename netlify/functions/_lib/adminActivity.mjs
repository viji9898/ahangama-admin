import { randomUUID } from "node:crypto";
import { query } from "./db.mjs";

export const ADMIN_ACTIVITY_TABLE = "admin_activity";

export function normalizeActivityText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function normalizeActivityLowerText(value) {
  const normalized = normalizeActivityText(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function diffFields(beforeRow, afterRow, fieldMap) {
  if (!beforeRow || !afterRow || !fieldMap) return [];

  return Object.entries(fieldMap).flatMap(([key, label]) => {
    const beforeValue = beforeRow[key] ?? null;
    const afterValue = afterRow[key] ?? null;
    return JSON.stringify(beforeValue) === JSON.stringify(afterValue) ? [] : [label];
  });
}

export async function logAdminActivity({
  action,
  actorEmail,
  entityType,
  entityId,
  entityName,
  venueId = null,
  contactId = null,
  changedFields = [],
  details = {},
}) {
  const normalizedActorEmail = normalizeActivityLowerText(actorEmail);
  const normalizedAction = normalizeActivityLowerText(action);
  const normalizedEntityType = normalizeActivityLowerText(entityType);
  const normalizedEntityId = normalizeActivityLowerText(entityId);

  if (!normalizedActorEmail || !normalizedAction || !normalizedEntityType || !normalizedEntityId) {
    return;
  }

  const normalizedEntityName = normalizeActivityText(entityName);
  const normalizedVenueId = normalizeActivityLowerText(venueId);
  const normalizedContactId = normalizeActivityLowerText(contactId);
  const normalizedChangedFields = Array.from(
    new Set(
      (Array.isArray(changedFields) ? changedFields : [])
        .map((field) => normalizeActivityText(field))
        .filter(Boolean),
    ),
  );

  await query(
    `
      INSERT INTO ${ADMIN_ACTIVITY_TABLE} (
        id, action, actor_email, entity_type, entity_id,
        entity_name, venue_id, contact_id, changed_fields, details
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::jsonb)
    `,
    [
      randomUUID(),
      normalizedAction,
      normalizedActorEmail,
      normalizedEntityType,
      normalizedEntityId,
      normalizedEntityName,
      normalizedVenueId,
      normalizedContactId,
      normalizedChangedFields.length ? normalizedChangedFields : null,
      JSON.stringify(details && typeof details === "object" ? details : {}),
    ],
  );
}

export function toAdminActivityDto(row) {
  return {
    id: row.id,
    action: row.action,
    actorEmail: row.actor_email,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name,
    venueId: row.venue_id,
    contactId: row.contact_id,
    changedFields: row.changed_fields ?? [],
    details: row.details ?? {},
    createdAt: row.created_at,
  };
}