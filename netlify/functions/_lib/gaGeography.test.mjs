import assert from "node:assert/strict";
import test from "node:test";
import {
  locationKey,
  mapGeographyRows,
  mapGeographyTotals,
  resolveGeographyPeriod,
} from "./gaGeography.mjs";

test("resolveGeographyPeriod accepts only supported periods", () => {
  assert.equal(resolveGeographyPeriod(), 30);
  assert.equal(resolveGeographyPeriod("7"), 7);
  assert.throws(() => resolveGeographyPeriod("28"), /7, 30, or 90/);
});

test("maps GA geography rows and percentages", () => {
  const report = {
    rows: [
      {
        dimensionValues: [
          { value: "Sri Lanka" },
          { value: "Southern Province" },
          { value: "Ahangama" },
        ],
        metricValues: [{ value: "25" }, { value: "31" }],
      },
      {
        dimensionValues: [
          { value: "United Kingdom" },
          { value: "England" },
          { value: "London" },
        ],
        metricValues: [{ value: "10" }, { value: "12" }],
      },
    ],
  };

  assert.deepEqual(mapGeographyRows(report, 50), [
    {
      key: "ahangama|southern province|sri lanka",
      city: "Ahangama",
      region: "Southern Province",
      country: "Sri Lanka",
      activeUsers: 25,
      sessions: 31,
      percentage: 0.5,
    },
    {
      key: "london|england|united kingdom",
      city: "London",
      region: "England",
      country: "United Kingdom",
      activeUsers: 10,
      sessions: 12,
      percentage: 0.2,
    },
  ]);
  assert.equal(
    locationKey({ city: " London ", region: "England", country: "UK" }),
    "london|england|uk",
  );
});

test("maps exact GA total metrics", () => {
  assert.deepEqual(
    mapGeographyTotals({
      rows: [{ metricValues: [{ value: "42" }, { value: "55" }] }],
    }),
    { activeUsers: 42, sessions: 55 },
  );
});