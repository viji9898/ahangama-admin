import { requireAdmin } from "./_lib/auth.mjs";
import { diffFields, logAdminActivity } from "./_lib/adminActivity.mjs";
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
  normalizeEventBoolean,
  normalizeEventDate,
  normalizeEventEnum,
  normalizeEventImageUrls,
  normalizeEventObject,
  normalizeEventOrder,
  normalizeEventTags,
  normalizeEventTextArray,
  normalizeEventTime,
  normalizeEventWeekday,
  normalizeIntelligenceScore,
  normalizeOptionalEventDate,
  normalizeOptionalEventNumber,
  normalizeOptionalEventObject,
  normalizeRequiredEventText,
  toEventDto,
} from "./_lib/events.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

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

const EVENT_ACTIVITY_FIELDS = {
  title: "title",
  description: "description",
  category: "category",
  subcategory: "subcategory",
  venue_id: "venue",
  venue_name: "venue name",
  start_date: "start date",
  start_time: "start time",
  display_time: "display time",
  image_url: "main image",
  image_urls: "image gallery",
  mobile_image_url: "mobile image",
  offer_image_url: "offer image",
  offer_text: "offer text",
  details: "details",
  venue_links: "venue links",
  pass_benefit: "pass benefit",
  status: "status",
  featured: "featured",
  editorial_pick: "editorial pick",
  featured_this_week: "this week",
  event_order: "event order",
};

export async function handler(event) {
  try {
    if (event.httpMethod !== "PUT" && event.httpMethod !== "PATCH") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const actor = requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const id = normalizeLowerText(body.id);
    if (!id) return json(400, { ok: false, error: "id is required" });

    const beforeResult = await query(
      `
        SELECT *
        FROM ${EVENTS_TABLE}
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id],
    );
    if (beforeResult.rowCount === 0) {
      return json(404, { ok: false, error: "Event not found" });
    }
    const beforeRow = beforeResult.rows[0];

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
      return json(400, { ok: false, error: "startDate must be before or equal to endDate" });
    }

    if (endTime && startTime >= endTime) {
      return json(400, { ok: false, error: "startTime must be before endTime" });
    }

    const result = await query(
      `
        UPDATE ${EVENTS_TABLE}
        SET
          title = $2,
          description = $3,
          category = $4,
          subcategory = $5,
          venue_id = $6,
          venue_name = $7,
          venue_instagram = $8,
          venue_google_url = $9,
          venue_lat = $10,
          venue_lng = $11,
          directions_url = $12,
          instagram_url = $13,
          start_date = $14,
          end_date = $15,
          start_time = $16,
          end_time = $17,
          day_key = $18,
          weekday = $19,
          day_number = $20,
          month = $21,
          display_time = $22,
          recurring = $23,
          recurring_type = $24,
          day_of_week = $25,
          price_type = $26,
          price = $27,
          booking_url = $28,
          whatsapp_number = $29,
          image_url = $30,
          image_urls = $31,
          mobile_image_url = $32,
          offer_image_url = $33,
          offer_text = $34,
          details = $35::jsonb,
          venue_links = $36::jsonb,
          pass_benefit = $37::jsonb,
          tags = $38,
          featured = $39,
          editorial_pick = $40,
          status = $41,
          source = $42,
          source_key = $43,
          raw_event = $44::jsonb,
          last_verified_at = $45,
          intelligence_score = $46,
          editor_priority = $47,
          editor_notes = $48,
          audience = $49,
          season = $50,
          featured_this_week = $51,
          event_order = $52,
          notes = $53,
          updated_by = $54,
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
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
        directionsUrl,
        instagramUrl,
        startDate,
        endDate,
        startTime,
        endTime,
        dayKey,
        weekday,
        dayNumber,
        month,
        displayTime,
        recurring,
        recurringType,
        dayOfWeek,
        priceType,
        price,
        bookingUrl,
        whatsappNumber,
        imageUrl || imageUrls[0] || null,
        imageUrls,
        mobileImageUrl,
        offerImageUrl,
        offerText,
        JSON.stringify(details),
        JSON.stringify(venueLinks),
        JSON.stringify(passBenefit),
        tags,
        featured,
        editorialPick,
        status,
        source,
        sourceKey,
        JSON.stringify(rawEvent),
        lastVerifiedAt,
        intelligenceScore,
        editorPriority,
        editorNotes,
        audience,
        season,
        featuredThisWeek,
        eventOrder,
        notes,
        actorEmail,
      ],
    );

    const row = result.rows[0];
    const changedFields = diffFields(beforeRow, row, EVENT_ACTIVITY_FIELDS);

    await logAdminActivity({
      action: "update",
      actorEmail: actor?.email,
      entityType: "event",
      entityId: row.id,
      entityName: row.title,
      venueId: row.venue_id,
      changedFields,
    });

    return json(200, { ok: true, event: toEventDto(row) });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}
