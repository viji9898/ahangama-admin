import { requireAdmin } from "./_lib/auth.mjs";
import { logAdminActivity } from "./_lib/adminActivity.mjs";
import { query } from "./_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "./_lib/crm.mjs";
import {
  EVENT_AUDIENCES,
  EVENT_CATEGORIES,
  EVENT_EDITOR_PRIORITIES,
  EVENT_PRICE_TYPES,
  EVENT_RECURRING_TYPES,
  EVENT_SEASONS,
  EVENT_STATUSES,
  EVENTS_TABLE,
  normalizeEventId,
  normalizeEventImageUrls,
  normalizeOptionalEventNumber,
  normalizeEventDate,
  normalizeEventBoolean,
  normalizeEventEnum,
  normalizeEventTags,
  normalizeEventTime,
  normalizeIntelligenceScore,
  normalizeOptionalEventDate,
  normalizeRequiredEventText,
  toEventDto,
} from "./_lib/events.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function badRequest(message) {
  return json(400, { ok: false, error: message });
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }

    const id = normalizeEventId(body.id);
    const startDate = normalizeEventDate(body.startDate || body.eventDate);
    const endDate = normalizeOptionalEventDate(body.endDate);
    const title = normalizeRequiredEventText(body.title, "title");
    const description = normalizeOptionalText(body.description);
    const category = normalizeEventEnum(
      body.category,
      EVENT_CATEGORIES,
      "wellness",
      "category",
    );
    const subcategory = normalizeOptionalText(body.subcategory);
    const venueId = normalizeLowerText(body.venueId);
    const venueName = normalizeRequiredEventText(body.venueName, "venueName");
    const venueInstagram = normalizeOptionalText(body.venueInstagram);
    const venueGoogleUrl = normalizeOptionalText(body.venueGoogleUrl);
    const venueLat = normalizeOptionalEventNumber(body.venueLat, "venueLat");
    const venueLng = normalizeOptionalEventNumber(body.venueLng, "venueLng");
    const startTime = normalizeEventTime(body.startTime, "startTime");
    const endTime = normalizeEventTime(body.endTime, "endTime", false);
    const recurring = normalizeEventBoolean(body.recurring);
    const recurringType = recurring
      ? normalizeEventEnum(
          body.recurringType,
          EVENT_RECURRING_TYPES,
          "weekly",
          "recurringType",
        )
      : null;
    const dayOfWeek = normalizeOptionalText(body.dayOfWeek);
    const priceType = normalizeEventEnum(
      body.priceType,
      EVENT_PRICE_TYPES,
      "free",
      "priceType",
    );
    const price = normalizeOptionalText(body.price);
    const bookingUrl = normalizeOptionalText(body.bookingUrl);
    const whatsappNumber = normalizeOptionalText(body.whatsappNumber);
    const imageUrl = normalizeOptionalText(body.imageUrl);
    const imageUrls = normalizeEventImageUrls(body.imageUrls, imageUrl);
    const tags = normalizeEventTags(body.tags);
    const featured = normalizeEventBoolean(body.featured);
    const editorialPick = normalizeEventBoolean(body.editorialPick);
    const status = normalizeEventEnum(
      body.status,
      EVENT_STATUSES,
      "draft",
      "status",
    );
    const source = normalizeOptionalText(body.source);
    const lastVerifiedAt = normalizeOptionalText(body.lastVerifiedAt);
    const intelligenceScore = normalizeIntelligenceScore(body.intelligenceScore);
    const editorPriority = normalizeEventEnum(
      body.editorPriority,
      EVENT_EDITOR_PRIORITIES,
      "medium",
      "editorPriority",
    );
    const editorNotes = normalizeOptionalText(body.editorNotes);
    const audience = normalizeEventEnum(
      body.audience,
      EVENT_AUDIENCES,
      "both",
      "audience",
    );
    const season = normalizeEventEnum(
      body.season,
      EVENT_SEASONS,
      "shoulder",
      "season",
    );
    const featuredThisWeek = normalizeEventBoolean(body.featuredThisWeek);
    const notes = normalizeOptionalText(body.notes);
    const actorEmail = normalizeLowerText(actor?.email);

    if (endDate && startDate > endDate) {
      return badRequest("startDate must be before or equal to endDate");
    }

    if (endTime && startTime >= endTime) {
      return badRequest("startTime must be before endTime");
    }

    const result = await query(
      `
        INSERT INTO ${EVENTS_TABLE} (
          id, title, description, category, subcategory, venue_id, venue_name,
          venue_instagram, venue_google_url, venue_lat, venue_lng, start_date,
          end_date, start_time, end_time, recurring, recurring_type, day_of_week,
          price_type, price, booking_url, whatsapp_number, image_url, image_urls,
          tags, featured, editorial_pick, status, source, last_verified_at,
          intelligence_score, editor_priority, editor_notes, audience, season,
          featured_this_week, notes, created_by, updated_by, deleted_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, NULL
        )
        RETURNING *
      `,
      [
        id,
        title,
        description,
        category,
        subcategory,
        venueId,
        venueName,
        venueInstagram,
        venueGoogleUrl,
        venueLat,
        venueLng,
        startDate,
        endDate,
        startTime,
        endTime,
        recurring,
        recurringType,
        dayOfWeek,
        priceType,
        price,
        bookingUrl,
        whatsappNumber,
        imageUrl || imageUrls[0] || null,
        imageUrls,
        tags,
        featured,
        editorialPick,
        status,
        source,
        lastVerifiedAt,
        intelligenceScore,
        editorPriority,
        editorNotes,
        audience,
        season,
        featuredThisWeek,
        notes,
        actorEmail,
        actorEmail,
      ],
    );

    const row = result.rows[0];

    await logAdminActivity({
      action: "create",
      actorEmail: actor?.email,
      entityType: "event",
      entityId: row.id,
      entityName: row.title,
      details: {
        category: row.category,
        subcategory: row.subcategory,
        startDate: row.start_date,
        venueName: row.venue_name,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        featuredThisWeek: row.featured_this_week,
      },
    });

    return json(200, { ok: true, event: toEventDto(row) });
  } catch (e) {
    return json(e?.statusCode || 500, { ok: false, error: String(e?.message || e) });
  }
}