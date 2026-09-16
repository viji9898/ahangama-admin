export const HOME_SECTION_ORDER = [
  "hero",
  "whats_on",
  "wellness_classes",
  "transport",
  "editors_picks",
  "weekly_picks",
  "guide_sections",
  "categories",
  "around_town",
  "pass_cta",
];

export const HOME_EVENTS = [
  "page_view",
  "home_section_view",
  "home_content_impression",
  "home_content_select",
  "home_outbound_click",
  "home_control_select",
  "newsletter_signup_success",
  "article_card_impression",
  "article_select",
  "pass_cta_click",
  "purchase",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function safeRate(numerator, denominator) {
  const top = Number(numerator);
  const bottom = Number(denominator);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom > 0
    ? top / bottom
    : null;
}

export function changeRate(current, previous) {
  const currentValue = Number(current);
  const previousValue = Number(previous);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return null;
  }
  if (previousValue === 0) return currentValue === 0 ? 0 : null;
  return (currentValue - previousValue) / previousValue;
}

export function cleanDimension(value) {
  const cleaned = String(value || "").trim();
  return cleaned === "(not set)" ? "" : cleaned;
}

export function normalizeKey(value) {
  return cleanDimension(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseDate(value) {
  if (!DATE_PATTERN.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

const dateValue = (date) => date.toISOString().slice(0, 10);

export function resolveDateRanges(params = {}, today = new Date()) {
  const preset = Number(params.days || 28);
  if (![7, 28, 90].includes(preset)) {
    throw new Error("days must be 7, 28, or 90");
  }

  const customStart = parseDate(params.startDate);
  const customEnd = parseDate(params.endDate);
  if ((params.startDate || params.endDate) && (!customStart || !customEnd)) {
    throw new Error("startDate and endDate must use YYYY-MM-DD");
  }

  const end = customEnd || new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  const start = customStart || new Date(end);
  if (!customStart) start.setUTCDate(start.getUTCDate() - preset + 1);
  if (start > end) throw new Error("startDate must not be after endDate");

  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days > 366) throw new Error("date range must not exceed 366 days");
  const comparisonEnd = new Date(start);
  comparisonEnd.setUTCDate(comparisonEnd.getUTCDate() - 1);
  const comparisonStart = new Date(comparisonEnd);
  comparisonStart.setUTCDate(comparisonStart.getUTCDate() - days + 1);

  return {
    current: { startDate: dateValue(start), endDate: dateValue(end) },
    previous: {
      startDate: dateValue(comparisonStart),
      endDate: dateValue(comparisonEnd),
    },
    days,
  };
}

export function normalizeFilters(params = {}, allowedChannels = []) {
  const device = cleanDimension(params.device || "all").toLowerCase();
  if (!["all", "mobile", "desktop", "tablet"].includes(device)) {
    throw new Error("invalid device filter");
  }
  const channel = cleanDimension(params.channel || "all");
  if (
    channel !== "all" &&
    allowedChannels.length &&
    !allowedChannels.includes(channel)
  ) {
    throw new Error("invalid channel filter");
  }
  return { device, channel };
}

export function buildKpis(values = {}, previous = {}) {
  const users = Number(values.users || 0);
  const items = {
    users,
    sessions: Number(values.sessions || 0),
    views: Number(values.views || 0),
    engagedSessions: Number(values.engagedSessions || 0),
    engagementRate: safeRate(values.engagedSessions, values.sessions),
    averageEngagementDuration: safeRate(values.engagementDuration, users),
    passCtaUsers: Number(values.passCtaUsers || 0),
    passCtaRate: safeRate(values.passCtaUsers, users),
    newsletterUsers: Number(values.newsletterUsers || 0),
    newsletterRate: safeRate(values.newsletterUsers, users),
    transportUsers: Number(values.transportUsers || 0),
    transportRate: safeRate(values.transportUsers, users),
  };
  const prior = buildKpisWithoutComparison(previous);
  return Object.fromEntries(
    Object.entries(items).map(([name, value]) => [
      name,
      { value, change: changeRate(value, prior[name]) },
    ]),
  );
}

function buildKpisWithoutComparison(values = {}) {
  const users = Number(values.users || 0);
  return {
    users,
    sessions: Number(values.sessions || 0),
    views: Number(values.views || 0),
    engagedSessions: Number(values.engagedSessions || 0),
    engagementRate: safeRate(values.engagedSessions, values.sessions),
    averageEngagementDuration: safeRate(values.engagementDuration, users),
    passCtaUsers: Number(values.passCtaUsers || 0),
    passCtaRate: safeRate(values.passCtaUsers, users),
    newsletterUsers: Number(values.newsletterUsers || 0),
    newsletterRate: safeRate(values.newsletterUsers, users),
    transportUsers: Number(values.transportUsers || 0),
    transportRate: safeRate(values.transportUsers, users),
  };
}

export function buildSectionRows(rows = [], homepageUsers = 0) {
  const grouped = new Map();
  for (const row of rows) {
    const key = normalizeKey(row.section);
    if (!key) continue;
    const item = grouped.get(key) || {
      section: key,
      users: 0,
      impressions: 0,
      selections: 0,
      selectingUsers: 0,
    };
    if (row.eventName === "home_section_view") item.users += Number(row.users || 0);
    if (["home_content_impression", "article_card_impression"].includes(row.eventName)) {
      item.impressions += Number(row.eventCount || 0);
    }
    if (["home_content_select", "article_select"].includes(row.eventName)) {
      item.selections += Number(row.eventCount || 0);
      item.selectingUsers += Number(row.users || 0);
    }
    grouped.set(key, item);
  }

  let previousUsers = Number(homepageUsers || 0);
  return HOME_SECTION_ORDER.map((section) => {
    const item = grouped.get(section) || {
      section,
      users: 0,
      impressions: 0,
      selections: 0,
      selectingUsers: 0,
    };
    const result = {
      ...item,
      reachRate: safeRate(item.users, homepageUsers),
      dropOffRate: safeRate(previousUsers - item.users, previousUsers),
      ctr: safeRate(item.selectingUsers, item.users),
    };
    previousUsers = item.users;
    return result;
  });
}

export function buildContentRows(rows = [], previousRows = []) {
  const aggregate = (source) => {
    const grouped = new Map();
    for (const row of source) {
      const contentId = cleanDimension(row.contentId);
      const location = cleanDimension(row.section || row.componentLocation);
      const key = [contentId || row.contentTitle, location, row.position].join("|");
      if (!contentId && !row.contentTitle) continue;
      const item = grouped.get(key) || {
        key,
        contentId,
        contentTitle: cleanDimension(row.contentTitle) || contentId || "Untitled",
        contentType: cleanDimension(row.contentType) || "content",
        location: location || "unclassified",
        position: cleanDimension(row.position),
        destination: cleanDimension(row.destination),
        impressionUsers: 0,
        selectingUsers: 0,
        selections: 0,
      };
      if (["home_content_impression", "article_card_impression"].includes(row.eventName)) {
        item.impressionUsers += Number(row.users || 0);
      }
      if (["home_content_select", "article_select"].includes(row.eventName)) {
        item.selectingUsers += Number(row.users || 0);
        item.selections += Number(row.eventCount || 0);
      }
      grouped.set(key, item);
    }
    return grouped;
  };

  const current = aggregate(rows);
  const prior = aggregate(previousRows);
  return [...current.values()]
    .map((item) => {
      const ctr = safeRate(item.selectingUsers, item.impressionUsers);
      const previous = prior.get(item.key);
      return {
        ...item,
        ctr,
        change: changeRate(
          ctr,
          safeRate(previous?.selectingUsers, previous?.impressionUsers),
        ),
      };
    })
    .sort((left, right) => right.impressionUsers - left.impressionUsers);
}

export function classifyAnalyticsError(error) {
  const message = String(error?.message || error || "Analytics request failed");
  if (/credential|authentication|unauthenticated|permission/i.test(message)) {
    return { code: "configuration", message: "GA4 credentials are unavailable or invalid." };
  }
  if (/quota|resource_exhausted|429/i.test(message)) {
    return { code: "quota", message: "GA4 quota is temporarily exhausted. Retry later." };
  }
  if (/custom dimension|not a valid dimension|incompatible/i.test(message)) {
    return { code: "dimension", message };
  }
  return { code: "api", message };
}