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
  normalizeEventObject,
  normalizeOptionalEventNumber,
  normalizeEventDate,
  normalizeEventBoolean,
  normalizeEventEnum,
  normalizeEventOrder,
  normalizeEventTags,
  normalizeEventTextArray,
  normalizeEventTime,
  normalizeEventWeekday,
  normalizeIntelligenceScore,
  normalizeOptionalEventObject,
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

function makeDateParts(startDate) {
  const date = new Date(`${startDate}T00:00:00+05:30`);
  return {
    dayKey: startDate,
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "Asia/Colombo",
    }).format(date),
    dayNumber: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      timeZone: "Asia/Colombo",
    }).format(date),
    month: new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "Asia/Colombo",
    }).format(date),
  };
}

function formatTimeLabel(value) {
  const [hourValue = "0", minuteValue = "0"] = String(value).split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
}

function makeDisplayTime(startTime, endTime) {
  return endTime
    ? `${formatTimeLabel(startTime)} - ${formatTimeLabel(endTime)}`
    : `From ${formatTimeLabel(startTime)}`;
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
    const mobileImageUrl = normalizeOptionalText(body.mobileImageUrl);
    const offerImageUrl = normalizeOptionalText(body.offerImageUrl);
    const offerText = normalizeOptionalText(body.offerText);
    const details = normalizeEventTextArray(body.details);
    const venueLinks = normalizeEventTextArray(body.venueLinks);
    const passBenefit = normalizeOptionalEventObject(body.passBenefit, [
      "label",
      "discount",
      "perk",
    ]);
    const eventOrder = normalizeEventOrder(body.eventOrder);
    const directionsUrl = normalizeOptionalText(body.directionsUrl) || venueGoogleUrl;
    const instagramUrl = normalizeOptionalText(body.instagramUrl) || venueInstagram;
    const sourceKey = normalizeOptionalText(body.sourceKey);
    const rawEvent = normalizeEventObject(body.rawEvent);
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
    const intelligenceScore = normalizeIntelligenceScore(
      body.intelligenceScore,
    );
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
    const dateParts = makeDateParts(startDate);
    const dayKey = normalizeOptionalText(body.dayKey) || dateParts.dayKey;
    const weekday = normalizeOptionalText(body.weekday) || dateParts.weekday;
    const dayNumber = normalizeOptionalText(body.dayNumber) || dateParts.dayNumber;
    const month = normalizeOptionalText(body.month) || dateParts.month;
    const displayTime = normalizeOptionalText(body.displayTime) || makeDisplayTime(startTime, endTime);
    const dayOfWeek = recurringType === "weekly"
      ? normalizeEventWeekday(body.dayOfWeek, dateParts.weekday)
      : null;

    if (endDate && startDate > endDate) {
      return badRequest("startDate must be before or equal to endDate");
    }

    if (endTime && startTime >= endTime) {
      return badRequest("startTime must be before endTime");
    }

    const columns = [
      "id", "title", "description", "category", "subcategory", "venue_id", "venue_name",
      "venue_instagram", "venue_google_url", "venue_lat", "venue_lng", "directions_url", "instagram_url",
      "start_date", "end_date", "start_time", "end_time", "day_key", "weekday", "day_number", "month", "display_time",
      "recurring", "recurring_type", "day_of_week", "price_type", "price", "booking_url", "whatsapp_number",
      "image_url", "image_urls", "mobile_image_url", "offer_image_url", "offer_text", "details", "venue_links", "pass_benefit",
      "tags", "featured", "editorial_pick", "status", "source", "source_key", "raw_event", "last_verified_at",
      "intelligence_score", "editor_priority", "editor_notes", "audience", "season", "featured_this_week", "event_order",
      "notes", "created_by", "updated_by", "deleted_at",
    ];
    const values = [
      id, title, description, category, subcategory, venueId, venueName,
      venueInstagram, venueGoogleUrl, venueLat, venueLng, directionsUrl, instagramUrl,
      startDate, endDate, startTime, endTime, dayKey, weekday, dayNumber, month, displayTime,
      recurring, recurringType, dayOfWeek, priceType, price, bookingUrl, whatsappNumber,
      imageUrl || imageUrls[0] || null, imageUrls, mobileImageUrl, offerImageUrl, offerText, JSON.stringify(details), JSON.stringify(venueLinks), JSON.stringify(passBenefit),
      tags, featured, editorialPick, status, source, sourceKey, JSON.stringify(rawEvent), lastVerifiedAt,
      intelligenceScore, editorPriority, editorNotes, audience, season, featuredThisWeek, eventOrder,
      notes, actorEmail, actorEmail, null,
    ];

    const result = await query(
      `
        INSERT INTO ${EVENTS_TABLE} (${columns.join(", ")})
        VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
        RETURNING *
      `,
      values,
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
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
