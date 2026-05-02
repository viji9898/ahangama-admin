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
    console.info("[daily-team-email] scheduled run started", {
      invokedAt: new Date().toISOString(),
    });

    const result = await runScheduledDailyTeamEmail();

    console.info("[daily-team-email] scheduled run completed", {
      skipped: Boolean(result?.skipped),
      reason: result?.reason || null,
      reportDate: result?.reportDate || null,
      recipientEmails: result?.recipientEmails || [],
      subject: result?.subject || null,
      londonNow: result?.londonNow || null,
    });

    return json(200, { ok: true, ...result });
  } catch (error) {
    console.error("[daily-team-email] scheduled run failed", {
      message: String(error?.message || error),
      statusCode: error?.statusCode || 500,
      stack: error?.stack || null,
    });

    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
