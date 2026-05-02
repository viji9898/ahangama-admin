import { query } from "./db.mjs";
import { getQrDashboardSummary } from "./ga4QrAnalytics.mjs";

const LONDON_TIME_ZONE = "Europe/London";
const REPORT_NAME = "daily-team-email";
const VENUES_TABLE = "venues260414";
const EMAIL_LOG_TABLE = "daily_team_email_sends";
const DEFAULT_FROM_EMAIL = "hello@ahangama.com";
const DEFAULT_TO_EMAILS = ["team@ahangama.com"];
const DEFAULT_DESTINATION_SLUG = "ahangama";
const MIN_RANKING_SESSIONS = 20;
const WATCHOUT_MAX_CONVERSION_RATE = 0.05;
const WATCHOUT_MAX_PURCHASE_RATE = 0.02;

function formatLabel(value) {
  const normalized = String(value || "unknown").trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function getTimeZoneParts(date = new Date(), timeZone = LONDON_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    dateIso: `${values.year}-${values.month}-${values.day}`,
    weekday: values.weekday,
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0),
  };
}

function shiftIsoDate(dateIso, days) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekStartIso(dateIso) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  return shiftIsoDate(dateIso, 1 - day);
}

function formatDisplayDate(dateIso) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "short",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

function toBooleanString(value) {
  return value === true || value === "true" || value === "1";
}

function parseEmailList(value, fallback = []) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? Array.from(new Set(items)) : fallback;
}

function getRecipientEmails() {
  return parseEmailList(process.env.DAILY_REPORT_TO_EMAILS, DEFAULT_TO_EMAILS);
}

function getSenderEmail() {
  return String(
    process.env.DAILY_REPORT_FROM_EMAIL || DEFAULT_FROM_EMAIL,
  ).trim();
}

function enrichRows(rows = []) {
  return rows.map((row) => {
    const sessions = Number(row.sessions || 0);
    const ctaClick = Number(row.ctaClick || 0);
    const purchases = Number(row.purchases || 0);
    const revenue = Number(row.revenue || 0);

    return {
      ...row,
      sessions,
      ctaClick,
      purchases,
      revenue,
      conversionRate: sessions > 0 ? ctaClick / sessions : 0,
      purchaseRate: sessions > 0 ? purchases / sessions : 0,
    };
  });
}

function comparePerformers(left, right) {
  return (
    right.purchases - left.purchases ||
    right.revenue - left.revenue ||
    right.purchaseRate - left.purchaseRate ||
    right.ctaClick - left.ctaClick ||
    right.sessions - left.sessions
  );
}

function compareWatchouts(left, right) {
  return (
    right.sessions - left.sessions ||
    left.purchaseRate - right.purchaseRate ||
    left.conversionRate - right.conversionRate ||
    left.purchases - right.purchases
  );
}

function getTopPerformers(rows) {
  const enrichedRows = enrichRows(rows);
  const eligibleRows = enrichedRows.filter(
    (row) => row.sessions >= MIN_RANKING_SESSIONS,
  );
  const sourceRows = eligibleRows.length ? eligibleRows : enrichedRows;

  return [...sourceRows].sort(comparePerformers).slice(0, 10);
}

function getTopWatchouts(rows) {
  const enrichedRows = enrichRows(rows);
  const sessionQualifiedRows = enrichedRows.filter(
    (row) => row.sessions >= MIN_RANKING_SESSIONS,
  );
  const baseRows = sessionQualifiedRows.length
    ? sessionQualifiedRows
    : enrichedRows.filter((row) => row.sessions > 0);
  const weakRows = baseRows.filter(
    (row) =>
      row.purchaseRate <= WATCHOUT_MAX_PURCHASE_RATE ||
      row.conversionRate <= WATCHOUT_MAX_CONVERSION_RATE,
  );
  const sourceRows = weakRows.length ? weakRows : baseRows;

  return [...sourceRows].sort(compareWatchouts).slice(0, 10);
}

function summarizeTotals(rows = [], stats = {}) {
  return rows.reduce(
    (accumulator, row) => ({
      sessions: accumulator.sessions + Number(row.sessions || 0),
      users: accumulator.users + Number(row.users || 0),
      events: accumulator.events + Number(row.events || 0),
      ctaClick: accumulator.ctaClick + Number(row.ctaClick || 0),
      purchases: accumulator.purchases + Number(row.purchases || 0),
      revenue: accumulator.revenue + Number(row.revenue || 0),
      totalCtaFromStats: Number(stats.ctaClick || 0),
    }),
    {
      sessions: 0,
      users: 0,
      events: 0,
      ctaClick: 0,
      purchases: 0,
      revenue: 0,
      totalCtaFromStats: Number(stats.ctaClick || 0),
    },
  );
}

function formatRowSummary(row) {
  return `${formatLabel(row.venue)} / ${formatLabel(row.surface)} - ${formatInteger(row.sessions)} sessions, ${formatInteger(row.ctaClick)} CTA clicks, ${formatInteger(row.purchases)} purchases, ${formatCurrency(row.revenue)}, ${formatPercent(row.purchaseRate)} purchase rate`;
}

function formatRowSummaryHtml(row) {
  return `<strong>${escapeHtml(formatLabel(row.venue))}</strong> / ${escapeHtml(formatLabel(row.surface))} - ${escapeHtml(formatInteger(row.sessions))} sessions, ${escapeHtml(formatInteger(row.ctaClick))} CTA clicks, ${escapeHtml(formatInteger(row.purchases))} purchases, ${escapeHtml(formatCurrency(row.revenue))}, ${escapeHtml(formatPercent(row.purchaseRate))} purchase rate`;
}

function buildThoughts({
  totals,
  performers,
  watchouts,
  rootTraffic,
  passTraffic,
  venueStats,
}) {
  const thoughts = [];
  const overallPurchaseRate =
    totals.sessions > 0 ? totals.purchases / totals.sessions : 0;
  const bestPerformer = performers[0];
  const biggestWatchout = watchouts[0];
  const passShare =
    rootTraffic.sessions > 0 ? passTraffic.sessions / rootTraffic.sessions : 0;

  if (bestPerformer) {
    thoughts.push(
      `${formatLabel(bestPerformer.venue)} / ${formatLabel(bestPerformer.surface)} is the strongest QR placement right now with ${formatInteger(bestPerformer.purchases)} purchases from ${formatInteger(bestPerformer.sessions)} sessions.`,
    );
  }

  if (biggestWatchout) {
    thoughts.push(
      `${formatLabel(biggestWatchout.venue)} / ${formatLabel(biggestWatchout.surface)} needs attention: ${formatInteger(biggestWatchout.sessions)} sessions are only producing a ${formatPercent(biggestWatchout.purchaseRate)} purchase rate.`,
    );
  }

  if (rootTraffic.sessions > 0) {
    thoughts.push(
      passShare >= 0.5
        ? `${formatPercent(passShare)} of QR traffic that reached ahangama.com also reached pass.ahangama.com, so the downstream journey is holding up.`
        : `Only ${formatPercent(passShare)} of QR traffic that reached ahangama.com made it to pass.ahangama.com, so there is visible drop-off after the first landing.`,
    );
  }

  if (venueStats.venuesAddedThisWeek > 0) {
    thoughts.push(
      `${formatInteger(venueStats.venuesAddedThisWeek)} venues were added this week and ${formatInteger(venueStats.totalLiveVenues)} are currently live.`,
    );
  } else if (overallPurchaseRate > 0) {
    thoughts.push(
      `Overall purchase efficiency for the day was ${formatPercent(overallPurchaseRate)} across all QR traffic.`,
    );
  }

  return thoughts.slice(0, 3);
}

async function getVenueStats(reportDate) {
  const destinationSlug = String(
    process.env.DAILY_REPORT_DESTINATION_SLUG || DEFAULT_DESTINATION_SLUG,
  ).trim();
  const weekStartDate = getWeekStartIso(reportDate);
  const reportDateExclusive = shiftIsoDate(reportDate, 1);
  const result = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND live = TRUE) AS total_live_venues,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL
            AND created_at >= $2::date
            AND created_at < $3::date
        ) AS venues_added_this_week
      FROM ${VENUES_TABLE}
      WHERE destination_slug = $1
    `,
    [destinationSlug, weekStartDate, reportDateExclusive],
  );
  const row = result.rows[0] || {};

  return {
    destinationSlug,
    weekStartDate,
    totalLiveVenues: Number(row.total_live_venues || 0),
    venuesAddedThisWeek: Number(row.venues_added_this_week || 0),
  };
}

export function getPreviousDayReportDate(now = new Date()) {
  const londonNow = getTimeZoneParts(now);
  return shiftIsoDate(londonNow.dateIso, -1);
}

export function getDefaultDailyReportDate(now = new Date()) {
  return getPreviousDayReportDate(now);
}

export function shouldRunDailyTeamEmail(now = new Date()) {
  return now.getUTCHours() === 0;
}

export async function getDailyTeamEmailReport({
  reportDate = getPreviousDayReportDate(),
} = {}) {
  console.info("[daily-team-email] building report", {
    reportDate,
  });

  const qrSummary = await getQrDashboardSummary({
    startDate: reportDate,
    endDate: reportDate,
  });
  const venueStats = await getVenueStats(reportDate);
  const totals = summarizeTotals(qrSummary.rows, qrSummary.stats);
  const performers = getTopPerformers(qrSummary.rows);
  const watchouts = getTopWatchouts(qrSummary.rows);
  const rootTraffic = qrSummary.rootTrafficRows[0] || {
    sessions: 0,
    users: 0,
    pageViews: 0,
  };
  const passTraffic = qrSummary.passTrafficRows[0] || {
    sessions: 0,
    users: 0,
    pageViews: 0,
  };
  const thoughts = buildThoughts({
    totals,
    performers,
    watchouts,
    rootTraffic,
    passTraffic,
    venueStats,
  });

  return {
    reportDate,
    reportDateLabel: formatDisplayDate(reportDate),
    totals,
    venueStats,
    performers,
    watchouts,
    thoughts,
    rootTraffic,
    passTraffic,
    qrSummary,
  };
}

export function buildDailyTeamEmailMessage(report) {
  const subject = `Previous day QR report - ${report.reportDateLabel}`;
  const summaryLines = [
    `Total sessions: ${formatInteger(report.totals.sessions)}`,
    `Total users: ${formatInteger(report.totals.users)}`,
    `CTA clicks: ${formatInteger(report.totals.totalCtaFromStats || report.totals.ctaClick)}`,
    `Purchases: ${formatInteger(report.totals.purchases)}`,
    `Revenue: ${formatCurrency(report.totals.revenue)}`,
    `Venues added this week: ${formatInteger(report.venueStats.venuesAddedThisWeek)}`,
    `Total live venues: ${formatInteger(report.venueStats.totalLiveVenues)}`,
  ];

  const performerLines = report.performers.map(
    (row, index) => `${index + 1}. ${formatRowSummary(row)}`,
  );
  const watchoutLines = report.watchouts.map(
    (row, index) => `${index + 1}. ${formatRowSummary(row)}`,
  );
  const thoughtLines = report.thoughts.map((line) => `- ${line}`);
  const text = [
    `Team,`,
    ``,
    `Here is the QR performance summary for the previous day, ${report.reportDateLabel}.`,
    ``,
    `Summary`,
    ...summaryLines.map((line) => `- ${line}`),
    ``,
    `Traffic flow`,
    `- ahangama.com: ${formatInteger(report.rootTraffic.sessions)} sessions, ${formatInteger(report.rootTraffic.users)} users, ${formatInteger(report.rootTraffic.pageViews)} page views`,
    `- pass.ahangama.com: ${formatInteger(report.passTraffic.sessions)} sessions, ${formatInteger(report.passTraffic.users)} users, ${formatInteger(report.passTraffic.pageViews)} page views`,
    ``,
    `Top 10 performers`,
    ...(performerLines.length ? performerLines : ["None"]),
    ``,
    `Top 10 watchouts`,
    ...(watchoutLines.length ? watchoutLines : ["None"]),
    ``,
    `Thoughts`,
    ...(thoughtLines.length ? thoughtLines : ["- No strong signal yet."]),
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Daily QR report</h2>
      <p style="margin-top: 0; color: #475569;">${escapeHtml(report.reportDateLabel)}</p>
      <h3>Summary</h3>
      <ul>${summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <h3>Traffic flow</h3>
      <ul>
        <li>ahangama.com: ${escapeHtml(formatInteger(report.rootTraffic.sessions))} sessions, ${escapeHtml(formatInteger(report.rootTraffic.users))} users, ${escapeHtml(formatInteger(report.rootTraffic.pageViews))} page views</li>
        <li>pass.ahangama.com: ${escapeHtml(formatInteger(report.passTraffic.sessions))} sessions, ${escapeHtml(formatInteger(report.passTraffic.users))} users, ${escapeHtml(formatInteger(report.passTraffic.pageViews))} page views</li>
      </ul>
      <h3>Top 10 performers</h3>
      <ol>${report.performers.map((row) => `<li>${formatRowSummaryHtml(row)}</li>`).join("") || "<li>None</li>"}</ol>
      <h3>Top 10 watchouts</h3>
      <ol>${report.watchouts.map((row) => `<li>${formatRowSummaryHtml(row)}</li>`).join("") || "<li>None</li>"}</ol>
      <h3>Thoughts</h3>
      <ul>${report.thoughts.map((line) => `<li>${escapeHtml(line)}</li>`).join("") || "<li>No strong signal yet.</li>"}</ul>
    </div>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}

export async function hasDailyTeamEmailBeenSent(reportDate) {
  const result = await query(
    `
      SELECT sent_at
      FROM ${EMAIL_LOG_TABLE}
      WHERE report_name = $1 AND report_date = $2::date
      LIMIT 1
    `,
    [REPORT_NAME, reportDate],
  );

  const alreadySent = Boolean(result.rows[0]);

  console.info("[daily-team-email] checked send ledger", {
    reportDate,
    alreadySent,
    sentAt: result.rows[0]?.sent_at || null,
  });

  return alreadySent;
}

async function recordDailyTeamEmailSend({
  reportDate,
  recipients,
  subject,
  report,
}) {
  await query(
    `
      INSERT INTO ${EMAIL_LOG_TABLE} (
        report_name,
        report_date,
        sent_to,
        subject,
        payload
      )
      VALUES ($1, $2::date, $3::text[], $4, $5::jsonb)
      ON CONFLICT (report_name, report_date) DO NOTHING
    `,
    [
      REPORT_NAME,
      reportDate,
      recipients,
      subject,
      JSON.stringify({
        totals: report.totals,
        venueStats: report.venueStats,
        topPerformer: report.performers[0] || null,
        topWatchout: report.watchouts[0] || null,
      }),
    ],
  );
}

export async function sendDailyTeamEmail({ report, force = false } = {}) {
  if (!report) {
    throw new Error("Missing report payload");
  }

  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing env var: SENDGRID_API_KEY");
  }

  const senderEmail = getSenderEmail();
  const recipientEmails = getRecipientEmails();
  if (!senderEmail) {
    throw new Error("Missing sender email for daily report");
  }
  if (!recipientEmails.length) {
    throw new Error("Missing recipient emails for daily report");
  }

  console.info("[daily-team-email] preparing send", {
    reportDate: report.reportDate,
    force,
    recipientCount: recipientEmails.length,
    senderEmail,
  });

  if (!force && (await hasDailyTeamEmailBeenSent(report.reportDate))) {
    console.info("[daily-team-email] send skipped", {
      reportDate: report.reportDate,
      reason: "already-sent",
      force,
    });

    return {
      skipped: true,
      reason: "already-sent",
      reportDate: report.reportDate,
      recipientEmails,
    };
  }

  const message = buildDailyTeamEmailMessage(report);

  console.info("[daily-team-email] sending via sendgrid", {
    reportDate: report.reportDate,
    recipientEmails,
    subject: message.subject,
  });

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: recipientEmails.map((email) => ({ email })),
        },
      ],
      from: {
        email: senderEmail,
        name: "Ahangama Admin",
      },
      subject: message.subject,
      content: [
        {
          type: "text/plain",
          value: message.text,
        },
        {
          type: "text/html",
          value: message.html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.text();

    console.error("[daily-team-email] sendgrid request failed", {
      reportDate: report.reportDate,
      status: response.status,
      payload,
    });

    throw new Error(`SendGrid request failed (${response.status}): ${payload}`);
  }

  console.info("[daily-team-email] sendgrid request accepted", {
    reportDate: report.reportDate,
    status: response.status,
  });

  await recordDailyTeamEmailSend({
    reportDate: report.reportDate,
    recipients: recipientEmails,
    subject: message.subject,
    report,
  });

  console.info("[daily-team-email] send recorded", {
    reportDate: report.reportDate,
    recipientEmails,
    subject: message.subject,
  });

  return {
    skipped: false,
    reportDate: report.reportDate,
    recipientEmails,
    subject: message.subject,
  };
}

export async function runScheduledDailyTeamEmail({ now = new Date() } = {}) {
  console.info("[daily-team-email] evaluating scheduled run", {
    nowIso: now.toISOString(),
    utcHour: now.getUTCHours(),
  });

  if (!shouldRunDailyTeamEmail(now)) {
    const londonNow = getTimeZoneParts(now);

    console.info("[daily-team-email] scheduled run skipped", {
      reason: "outside-utc-midnight-window",
      londonNow,
    });

    return {
      skipped: true,
      reason: "outside-utc-midnight-window",
      londonNow,
    };
  }

  const reportDate = getPreviousDayReportDate(now);

  console.info("[daily-team-email] scheduled run generating report", {
    reportDate,
  });

  const report = await getDailyTeamEmailReport({
    reportDate,
  });

  return sendDailyTeamEmail({ report, force: false });
}

export function getDailyTeamEmailPreview(report) {
  const message = buildDailyTeamEmailMessage(report);

  return {
    reportDate: report.reportDate,
    subject: message.subject,
    text: message.text,
    venueStats: report.venueStats,
    totals: report.totals,
    performers: report.performers,
    watchouts: report.watchouts,
    thoughts: report.thoughts,
  };
}

export function isTruthyQueryParam(value) {
  return toBooleanString(value);
}
