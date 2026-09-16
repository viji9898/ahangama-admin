import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContentRows,
  buildKpis,
  buildSectionRows,
  changeRate,
  classifyAnalyticsError,
  normalizeFilters,
  resolveDateRanges,
  safeRate,
} from "./homepageEngagement.mjs";

test("calculates rates and previous-period changes safely", () => {
  assert.equal(safeRate(20, 100), 0.2);
  assert.equal(safeRate(1, 0), null);
  assert.equal(changeRate(120, 100), 0.2);
  assert.equal(changeRate(5, 0), null);
  const kpis = buildKpis(
    { users: 100, sessions: 120, engagedSessions: 60, passCtaUsers: 10 },
    { users: 80, sessions: 100, engagedSessions: 40, passCtaUsers: 4 },
  );
  assert.equal(kpis.engagementRate.value, 0.5);
  assert.equal(kpis.passCtaRate.value, 0.1);
  assert.equal(kpis.users.change, 0.25);
});

test("validates presets, custom dates, and comparison windows", () => {
  const preset = resolveDateRanges({ days: "7" }, new Date("2026-09-16T12:00:00Z"));
  assert.deepEqual(preset.current, { startDate: "2026-09-10", endDate: "2026-09-16" });
  assert.deepEqual(preset.previous, { startDate: "2026-09-03", endDate: "2026-09-09" });
  assert.throws(() => resolveDateRanges({ days: "30" }), /7, 28, or 90/);
  assert.throws(
    () => resolveDateRanges({ days: "28", startDate: "2026-09-20", endDate: "2026-09-01" }),
    /must not be after/,
  );
});

test("validates device and channel filters", () => {
  assert.deepEqual(normalizeFilters({ device: "mobile", channel: "Direct" }, ["Direct"]), {
    device: "mobile",
    channel: "Direct",
  });
  assert.throws(() => normalizeFilters({ device: "watch" }), /invalid device/);
  assert.throws(() => normalizeFilters({ channel: "Unknown" }, ["Direct"]), /invalid channel/);
});

test("normalizes section reach, drop-off, and user CTR in intended order", () => {
  const rows = buildSectionRows([
    { section: "Hero", eventName: "home_section_view", users: 80 },
    { section: "Hero", eventName: "home_content_select", users: 8, eventCount: 10 },
    { section: "What's On", eventName: "home_section_view", users: 40 },
  ], 100);
  assert.equal(rows[0].section, "hero");
  assert.equal(rows[0].reachRate, 0.8);
  assert.equal(rows[0].ctr, 0.1);
  assert.equal(rows[1].section, "whats_on");
  assert.equal(rows[1].dropOffRate, 0.5);
});

test("combines home and historical article content without renaming events", () => {
  const rows = buildContentRows([
    { eventName: "article_card_impression", contentId: "story", contentTitle: "Story", section: "editors_picks", users: 50, eventCount: 60 },
    { eventName: "article_select", contentId: "story", contentTitle: "Story", section: "editors_picks", users: 5, eventCount: 7 },
  ], [
    { eventName: "article_card_impression", contentId: "story", contentTitle: "Story", section: "editors_picks", users: 40 },
    { eventName: "article_select", contentId: "story", contentTitle: "Story", section: "editors_picks", users: 2 },
  ]);
  assert.equal(rows[0].ctr, 0.1);
  assert.equal(rows[0].change, 1);
});

test("classifies configuration, quota, dimension, and generic API errors", () => {
  assert.equal(classifyAnalyticsError(new Error("missing credentials")).code, "configuration");
  assert.equal(classifyAnalyticsError(new Error("429 quota exceeded")).code, "quota");
  assert.equal(classifyAnalyticsError(new Error("not a valid dimension")).code, "dimension");
  assert.equal(classifyAnalyticsError(new Error("network failed")).code, "api");
});