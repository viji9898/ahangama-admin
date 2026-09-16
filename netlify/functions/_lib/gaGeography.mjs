const SUPPORTED_PERIODS = new Set([7, 30, 90]);

function cleanValue(value) {
  const normalized = String(value || "").trim();
  return normalized === "(not set)" ? "" : normalized;
}

function metricValue(row, index) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

export function resolveGeographyPeriod(value) {
  const period = Number(value || 30);
  if (!SUPPORTED_PERIODS.has(period)) {
    const error = new Error("Period must be 7, 30, or 90 days");
    error.statusCode = 400;
    throw error;
  }
  return period;
}

export function locationKey({ city, region, country }) {
  return [city, region, country]
    .map((value) => cleanValue(value).toLocaleLowerCase("en-US"))
    .join("|");
}

export function mapGeographyRows(report, totalActiveUsers) {
  return (report?.rows || [])
    .map((row) => {
      const country = cleanValue(row?.dimensionValues?.[0]?.value);
      const region = cleanValue(row?.dimensionValues?.[1]?.value);
      const city = cleanValue(row?.dimensionValues?.[2]?.value);
      const activeUsers = metricValue(row, 0);
      const sessions = metricValue(row, 1);

      return {
        key: locationKey({ city, region, country }),
        city: city || "Unknown city",
        region: region || "Unknown region",
        country: country || "Unknown country",
        activeUsers,
        sessions,
        percentage:
          totalActiveUsers > 0 ? activeUsers / totalActiveUsers : 0,
      };
    })
    .filter((row) => row.activeUsers > 0 && row.country !== "Unknown country")
    .sort((left, right) => right.activeUsers - left.activeUsers);
}

export function mapGeographyTotals(report) {
  const row = report?.rows?.[0];
  return {
    activeUsers: metricValue(row, 0),
    sessions: metricValue(row, 1),
  };
}