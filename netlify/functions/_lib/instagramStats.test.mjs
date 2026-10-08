import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInstagramReport,
  normalizeInstagramReportDays,
  normalizeInstagramTimeSeries,
} from "./instagramStats.mjs";

const now = Date.parse("2026-10-07T12:00:00.000Z");
const post = (timestamp, overrides = {}) => ({
  id: timestamp,
  timestamp,
  mediaType: "IMAGE",
  mediaProductType: "FEED",
  views: 100,
  reach: 50,
  likes: 8,
  comments: 2,
  shares: 1,
  saved: 1,
  interactions: 12,
  ...overrides,
});

test("normalizes supported Instagram report periods", () => {
  assert.equal(normalizeInstagramReportDays("7"), 7);
  assert.equal(normalizeInstagramReportDays(90), 90);
  assert.equal(normalizeInstagramReportDays("14"), 30);
});

test("builds current and previous period totals without older posts", () => {
  const report = buildInstagramReport(
    [
      post("2026-10-06T12:00:00.000Z"),
      post("2026-10-05T12:00:00.000Z", {
        mediaProductType: "REELS",
        interactions: 20,
      }),
      post("2026-09-29T12:00:00.000Z"),
      post("2026-09-10T12:00:00.000Z"),
    ],
    7,
    now,
  );

  assert.equal(report.totals.posts, 2);
  assert.equal(report.totals.views, 200);
  assert.equal(report.totals.interactions, 32);
  assert.equal(report.previousTotals.posts, 1);
  assert.deepEqual(
    report.formats.map(({ format, posts }) => [format, posts]),
    [
      ["REELS", 1],
      ["FEED", 1],
    ],
  );
});

test("normalizes Meta time-series metrics by date", () => {
  const series = normalizeInstagramTimeSeries(
    [
      {
        data: [
          {
            name: "views",
            values: [
              { end_time: "2026-10-05T00:00:00+0000", value: 100 },
              { end_time: "2026-10-06T00:00:00+0000", value: 150 },
            ],
          },
          {
            name: "total_interactions",
            values: [
              { end_time: "2026-10-05T00:00:00+0000", value: 12 },
            ],
          },
        ],
      },
    ],
    Date.parse("2026-10-05T00:00:00.000Z"),
    Date.parse("2026-10-07T00:00:00.000Z"),
  );

  assert.deepEqual(series, [
    {
      date: "2026-10-05",
      views: 100,
      reach: 0,
      interactions: 12,
      follows: 0,
    },
    {
      date: "2026-10-06",
      views: 150,
      reach: 0,
      interactions: 0,
      follows: 0,
    },
  ]);
});