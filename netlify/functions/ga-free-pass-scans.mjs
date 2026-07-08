import { requireAdmin } from "./_lib/auth.mjs";
import { getFreePassPromoStats } from "./_lib/freePassPromoStats.mjs";

const DEFAULT_START_DATE = "30daysAgo";
const DEFAULT_END_DATE = "today";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

function getDateRange(queryStringParameters = {}) {
  const startDate = String(
    queryStringParameters.startDate || DEFAULT_START_DATE,
  ).trim();
  const endDate = String(
    queryStringParameters.endDate || DEFAULT_END_DATE,
  ).trim();

  return {
    startDate: startDate || DEFAULT_START_DATE,
    endDate: endDate || DEFAULT_END_DATE,
  };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const { startDate, endDate } = getDateRange(
      event.queryStringParameters || {},
    );
    const stats = await getFreePassPromoStats({ startDate, endDate });

    return json(200, {
      ok: true,
      ...stats,
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}