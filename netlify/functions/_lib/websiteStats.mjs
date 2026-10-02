function pageMetric(row) {
  return Number(row?.metricValues?.[0]?.value || 0);
}

function normalizePagePath(value) {
  const path = String(value || "/").trim() || "/";
  return path === "/" ? path : path.replace(/\/+$/, "") || "/";
}

export function aggregateTopPages(rows = [], limit = 8) {
  const pages = new Map();

  for (const row of rows) {
    const path = normalizePagePath(row.dimensionValues?.[0]?.value);
    const title = row.dimensionValues?.[1]?.value || "";
    const views = pageMetric(row);
    const current = pages.get(path) || {
      path,
      title: "Untitled page",
      titleViews: -1,
      views: 0,
    };

    current.views += views;
    if (title && title !== "(not set)" && views > current.titleViews) {
      current.title = title;
      current.titleViews = views;
    }
    pages.set(path, current);
  }

  return [...pages.values()]
    .map(({ path, title, views }) => ({ path, title, views }))
    .sort(
      (left, right) =>
        right.views - left.views || left.path.localeCompare(right.path),
    )
    .slice(0, limit);
}