export function safeRate(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  return bottom > 0 && Number.isFinite(top) && Number.isFinite(bottom)
    ? top / bottom
    : null;
}

export function calculateArticleKpis(eventCounts, activeReadSeconds = null) {
  const count = (eventName) => Number(eventCounts[eventName] || 0);
  const views = count("article_view");
  const engagedReads = count("article_engaged_read");
  const completions = count("article_complete");
  const outboundClicks = count("article_outbound_click");
  const nextSelections = count("article_next_select");
  const activeSeconds = Number(activeReadSeconds);

  return {
    views,
    engagedReads,
    qualifiedReadRate: safeRate(engagedReads, views),
    completions,
    completionRate: safeRate(completions, engagedReads),
    averageActiveReadSeconds:
      engagedReads > 0 && Number.isFinite(activeSeconds)
        ? activeSeconds / engagedReads
        : null,
    outboundClicks,
    placeIntentRate: safeRate(outboundClicks, engagedReads),
    nextSelections,
    continuationRate: safeRate(nextSelections, completions),
  };
}

export function calculateDiscoveryRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const location = row.componentLocation || "unclassified";
    const item = grouped.get(location) || {
      componentLocation: location,
      impressions: 0,
      selections: 0,
    };
    if (row.eventName === "article_card_impression") {
      item.impressions += row.eventCount;
    }
    if (row.eventName === "article_select") item.selections += row.eventCount;
    grouped.set(location, item);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      ctr: safeRate(item.selections, item.impressions),
    }))
    .sort((left, right) => right.impressions - left.impressions);
}
