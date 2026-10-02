import assert from "node:assert/strict";
import test from "node:test";
import { aggregateTopPages } from "./websiteStats.mjs";

const pageRow = (path, title, views) => ({
  dimensionValues: [{ value: path }, { value: title }],
  metricValues: [{ value: String(views) }],
});

test("combines page title variants for the same normalized URL", () => {
  assert.deepEqual(
    aggregateTopPages([
      pageRow("/", "Ahangama, Sri Lanka: Local Guide, Events & Places", 13000),
      pageRow("/", "Experience Ahangama, The Insider's Guide", 4200),
      pageRow("/", "Ahangama.com — Discover Ahangama, Sri Lanka", 3300),
      pageRow("/places/", "Places in Ahangama", 500),
      pageRow("/places", "(not set)", 250),
    ]),
    [
      {
        path: "/",
        title: "Ahangama, Sri Lanka: Local Guide, Events & Places",
        views: 20500,
      },
      { path: "/places", title: "Places in Ahangama", views: 750 },
    ],
  );
});

test("sorts combined pages before applying the result limit", () => {
  assert.deepEqual(
    aggregateTopPages(
      [
        pageRow("/first", "First", 4),
        pageRow("/second", "Second", 3),
        pageRow("/second", "Second page", 3),
      ],
      1,
    ),
    [{ path: "/second", title: "Second", views: 6 }],
  );
});