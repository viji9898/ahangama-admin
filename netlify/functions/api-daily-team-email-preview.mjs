import { requireAdmin } from "./_lib/auth.mjs";
import {
  getDailyTeamEmailPreview,
  getDailyTeamEmailReport,
  getPreviousDayReportDate,
  hasDailyTeamEmailBeenSent,
  isTruthyQueryParam,
  sendDailyTeamEmail,
} from "./_lib/dailyTeamEmail.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

function resolveReportDate(queryStringParameters = {}) {
  const value = String(queryStringParameters.date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : getPreviousDayReportDate();
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const queryStringParameters = event.queryStringParameters || {};
    const reportDate = resolveReportDate(queryStringParameters);
    const report = await getDailyTeamEmailReport({ reportDate });
    const alreadySent = await hasDailyTeamEmailBeenSent(reportDate);

    if (isTruthyQueryParam(queryStringParameters.send)) {
      const sendResult = await sendDailyTeamEmail({
        report,
        force: isTruthyQueryParam(queryStringParameters.force),
      });

      return json(200, {
        ok: true,
        reportDate,
        alreadySent,
        sendResult,
        preview: getDailyTeamEmailPreview(report),
      });
    }

    return json(200, {
      ok: true,
      reportDate,
      alreadySent,
      preview: getDailyTeamEmailPreview(report),
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}