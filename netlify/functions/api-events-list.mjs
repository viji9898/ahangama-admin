import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  EVENTS_TABLE,
  normalizeEventEnum,
  normalizeEventSearch,
  toEventDto,
} from "./_lib/events.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const qs = event.queryStringParameters || {};
    const q = normalizeEventSearch(qs.q);
    const statusFilter = qs.status
      ? normalizeEventEnum(qs.status, EVENT_STATUSES, "published", "status")
      : null;
    const categoryFilter = qs.category
      ? normalizeEventEnum(qs.category, EVENT_CATEGORIES, "wellness", "category")
      : null;
    const featuredThisWeekFilter =
      String(qs.featuredThisWeek || "").toLowerCase() === "true"
        ? true
        : null;

    const where = ["deleted_at IS NULL"];
    const params = [];
    let idx = 1;

    if (statusFilter) {
      where.push(`status = $${idx}`);
      params.push(statusFilter);
      idx += 1;
    }

    if (categoryFilter) {
      where.push(`category = $${idx}`);
      params.push(categoryFilter);
      idx += 1;
    }

    if (featuredThisWeekFilter !== null) {
      where.push(`featured_this_week = $${idx}`);
      params.push(featuredThisWeekFilter);
      idx += 1;
    }

    if (q) {
      where.push(`(
        lower(title) LIKE $${idx}
        OR lower(venue_name) LIKE $${idx}
        OR lower(coalesce(description, '')) LIKE $${idx}
        OR lower(coalesce(subcategory, '')) LIKE $${idx}
        OR lower(coalesce(display_time, '')) LIKE $${idx}
        OR lower(coalesce(offer_text, '')) LIKE $${idx}
        OR lower(coalesce(editor_notes, '')) LIKE $${idx}
        OR lower(coalesce(source, '')) LIKE $${idx}
        OR lower(coalesce(source_key, '')) LIKE $${idx}
        OR EXISTS (SELECT 1 FROM unnest(tags) tag WHERE lower(tag) LIKE $${idx})
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(details) detail WHERE lower(detail) LIKE $${idx})
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(venue_links) link WHERE lower(link) LIKE $${idx})
      )`);
      params.push(`%${q}%`);
      idx += 1;
    }

    const result = await query(
      `
        SELECT *
        FROM ${EVENTS_TABLE}
        WHERE ${where.join(" AND ")}
        ORDER BY featured_this_week DESC, editorial_pick DESC, featured DESC,
          start_date ASC, start_time ASC, created_at DESC
        LIMIT 1000
      `,
      params,
    );

    return json(200, { ok: true, events: result.rows.map(toEventDto) });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}