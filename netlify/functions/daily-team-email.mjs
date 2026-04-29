import { runScheduledDailyTeamEmail } from "./_lib/dailyTeamEmail.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

export async function handler() {
  try {
    const result = await runScheduledDailyTeamEmail();
    return json(200, { ok: true, ...result });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}