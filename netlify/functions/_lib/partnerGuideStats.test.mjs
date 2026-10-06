import assert from "node:assert/strict";
import test from "node:test";
import { reconcileVenueOutboundClicks } from "./partnerGuideStats.mjs";

test("reconciles repeated automatic clicks without double-counting custom events", () => {
  const outbound = reconcileVenueOutboundClicks(
    [
      { label: "website", value: 2 },
      { label: "instagram", value: 3 },
      { label: "google_maps", value: 2 },
    ],
    12,
    [
      { url: "https://example.com/", value: 5 },
      { url: "https://instagram.com/example", value: 2 },
      { url: "https://maps.app.goo.gl/example", value: 2 },
    ],
    {
      website: "https://www.example.com",
      instagram: "example",
      mapUrl: "https://maps.app.goo.gl/example",
    },
  );

  assert.deepEqual(outbound, {
    engagements: 12,
    linkTypes: [
      { label: "website", value: 5 },
      { label: "instagram", value: 3 },
      { label: "google_maps", value: 2 },
      { label: "unclassified", value: 2 },
    ],
  });
});