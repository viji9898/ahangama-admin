import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateArticleKpis,
  calculateDiscoveryRows,
  safeRate,
} from "./articleInsights.mjs";

test("calculates Article Insights KPIs from unique milestone event counts", () => {
  const kpis = calculateArticleKpis(
    {
      article_view: 100,
      article_engaged_read: 40,
      article_complete: 20,
      article_outbound_click: 10,
      article_next_select: 5,
    },
    1_200,
  );

  assert.deepEqual(kpis, {
    views: 100,
    engagedReads: 40,
    qualifiedReadRate: 0.4,
    completions: 20,
    completionRate: 0.5,
    averageActiveReadSeconds: 30,
    outboundClicks: 10,
    placeIntentRate: 0.25,
    nextSelections: 5,
    continuationRate: 0.25,
  });
});

test("returns null for rates and averages without a valid denominator", () => {
  const kpis = calculateArticleKpis({ article_outbound_click: 2 }, 10);

  assert.equal(safeRate(1, 0), null);
  assert.equal(safeRate(1, Number.POSITIVE_INFINITY), null);
  assert.equal(kpis.qualifiedReadRate, null);
  assert.equal(kpis.completionRate, null);
  assert.equal(kpis.averageActiveReadSeconds, null);
  assert.equal(kpis.placeIntentRate, null);
  assert.equal(kpis.continuationRate, null);
});

test("calculates discovery CTR independently for each placement", () => {
  const rows = calculateDiscoveryRows([
    { componentLocation: "articles_featured", eventName: "article_card_impression", eventCount: 20 },
    { componentLocation: "articles_featured", eventName: "article_select", eventCount: 4 },
    { componentLocation: "articles_index", eventName: "article_select", eventCount: 2 },
  ]);

  assert.equal(rows[0].ctr, 0.2);
  assert.equal(rows[1].ctr, null);
});