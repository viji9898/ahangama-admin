import { randomUUID } from "node:crypto";
import { query, queryFromEnv } from "./db.mjs";

const DATABASE_ENV = "NETLIFY_DATABASE_URL";
const AUDIENCE_TABLES = {
  circle: "circle",
  guest: "pass_guests",
  hospo: "hospo_pass_profiles",
};
const ALLOWED_BLOCK_TYPES = new Set([
  "hero",
  "feature",
  "cards",
  "text",
  "buttons",
  "divider",
]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphs(value = "") {
  return String(value)
    .split(/\n{2,}/)
    .map(
      (part) =>
        `<p style="margin:0 0 16px;font:400 14px/1.7 Arial,sans-serif;color:#333;">${escapeHtml(part).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

function button(label, url) {
  if (!label || !url) return "";
  return `<table role="presentation" width="100%"><tr><td class="mobile-button-cell"><a class="mobile-button" href="${escapeHtml(url)}" style="display:inline-block;background:#111;color:#fbfaf6;font:700 11px/1 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:14px 18px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function renderBlock(block) {
  if (!block || !ALLOWED_BLOCK_TYPES.has(block.type)) return "";

  if (block.type === "divider") {
    return `<tr><td style="height:1px;background:#111;font-size:0;line-height:0;">&nbsp;</td></tr>`;
  }

  if (block.type === "hero") {
    return `<tr><td class="mobile-content-padding" style="padding:32px 38px;background:#fbfaf6;border-bottom:1px solid #111;"><h1 class="mobile-hero-heading" style="font:700 32px/1.1 Georgia,serif;margin:0 0 14px;color:#111;">${escapeHtml(block.heading)}</h1>${paragraphs(block.body)}${button(block.ctaLabel, block.ctaUrl)}</td></tr>`;
  }

  if (block.type === "feature") {
    const image = block.imageUrl
      ? `<tr><td><img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.imageAlt)}" width="640" style="display:block;width:100%;height:auto;border:0;"></td></tr>`
      : "";
    return `<tr><td style="background:${escapeHtml(block.background || "#fbfaf6")};border-bottom:1px solid #111;"><table role="presentation" width="100%">${image}<tr><td class="mobile-content-padding" style="padding:28px 38px;">${block.label ? `<div style="font:700 10px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#777;margin-bottom:8px;">${escapeHtml(block.label)}</div>` : ""}<h2 class="mobile-section-heading" style="font:700 26px/1.1 Georgia,serif;margin:0 0 14px;color:#111;">${escapeHtml(block.heading)}</h2>${paragraphs(block.body)}${button(block.ctaLabel, block.ctaUrl)}</td></tr></table></td></tr>`;
  }

  if (block.type === "cards") {
    const cards = (Array.isArray(block.items) ? block.items : []).slice(0, 3);
    return `<tr><td class="mobile-cards-padding" style="padding:28px 30px;background:#f4f0e8;border-bottom:1px solid #111;"><table role="presentation" width="100%"><tr>${cards.map((item) => `<td class="mobile-card" style="width:${100 / Math.max(cards.length, 1)}%;padding:8px;vertical-align:top;">${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" width="170" style="display:block;width:100%;height:auto;margin-bottom:12px;">` : ""}<h3 style="font:700 18px/1.2 Georgia,serif;margin:0 0 8px;">${escapeHtml(item.heading)}</h3>${paragraphs(item.body)}${item.url ? `<a href="${escapeHtml(item.url)}" style="font:700 11px Arial,sans-serif;color:#111;">${escapeHtml(item.linkLabel || "Read more")}</a>` : ""}</td>`).join("")}</tr></table></td></tr>`;
  }

  if (block.type === "buttons") {
    return `<tr><td class="mobile-content-padding" style="padding:24px 38px;background:#fbfaf6;text-align:center;border-bottom:1px solid #111;">${(block.items || []).map((item) => button(item.label, item.url)).join("<br>")}</td></tr>`;
  }

  return `<tr><td class="mobile-content-padding" style="padding:28px 38px;background:${escapeHtml(block.background || "#fbfaf6")};border-bottom:1px solid #111;">${block.heading ? `<h2 class="mobile-section-heading" style="font:700 26px/1.1 Georgia,serif;margin:0 0 14px;color:#111;">${escapeHtml(block.heading)}</h2>` : ""}${paragraphs(block.body)}</td></tr>`;
}

function renderStandardFooter() {
  const year = new Date().getFullYear();
  return `<tr><td class="mobile-content-padding" style="padding:26px 38px;background:#fbfaf6;border-bottom:1px solid #111;text-align:center;"><div style="font:700 10px/1.2 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-bottom:10px;">For Businesses</div><h2 class="mobile-section-heading" style="font:700 20px/1.3 Georgia,serif;margin:0 0 8px;color:#111;">Want to be featured?</h2><p style="font:400 13px/1.6 Arial,sans-serif;color:#333;margin:0 auto 16px;max-width:440px;">If you run a business, host events, or have an offer for the Ahangama community, we'd love to feature you in next month's newsletter.</p><table role="presentation" width="100%"><tr><td class="mobile-button-cell" align="center"><a class="mobile-button footer-cta" href="https://wa.me/94772733202?text=Hi%2C%20I%27d%20like%20to%20be%20featured%20in%20the%20Ahangama%20newsletter" style="display:inline-block;background:#111;border:1px solid #111;color:#fbfaf6;font:700 11px/1 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:15px 28px;">To Be Featured</a></td></tr></table></td></tr><tr><td class="mobile-content-padding" style="padding:24px 38px;background:#fbfaf6;border-bottom:1px solid #111;text-align:center;"><div style="font:700 10px/1.2 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-bottom:14px;">Stay Connected</div><a aria-label="Ahangama Pass Instagram" href="https://www.instagram.com/ahangama.pass/" style="font:700 11px/28px Arial,sans-serif;color:#111;text-decoration:none;display:inline-block;width:28px;height:28px;border:1.5px solid #111;border-radius:7px;margin:0 5px;vertical-align:middle;" title="Ahangama Pass Instagram">IG</a><a aria-label="Ahangama Pass TikTok" href="https://www.tiktok.com/@ahangama.pass" style="font:700 15px/28px Arial,sans-serif;color:#111;text-decoration:none;display:inline-block;width:28px;height:28px;border:1.5px solid #111;border-radius:50%;margin:0 5px;vertical-align:middle;" title="Ahangama Pass TikTok">♪</a><a aria-label="Ahangama Pass Website" href="https://ahangamapass.com" style="font:700 15px/28px Arial,sans-serif;color:#111;text-decoration:none;display:inline-block;width:28px;height:28px;border:1.5px solid #111;border-radius:6px;margin:0 5px;vertical-align:middle;" title="Ahangama Pass Website">↗</a></td></tr><tr><td class="email-footer mobile-content-padding" style="padding:20px 38px 24px;background:#fbfaf6;text-align:center;"><p style="font:400 10px/1.6 Arial,sans-serif;color:#777;margin:0 0 10px;text-align:center;">This email is from Ahangama Pass. You have received this email because you have previously provided us with your email address and subscribed to Ahangama Pass. <a href="{{{unsubscribe}}}" style="font:400 9px/1 Arial,sans-serif;color:#777;text-decoration:underline;white-space:nowrap;">unsubscribe</a></p><p style="font:700 10px/1.4 Arial,sans-serif;color:#111;margin:0;text-align:center;">&copy; ${year} ahangama pass</p></td></tr>`;
}

export function normalizeBlocks(value) {
  if (!Array.isArray(value)) throw new Error("Blocks must be an array");
  return value
    .filter((block) => block && ALLOWED_BLOCK_TYPES.has(block.type))
    .map((block) => ({ ...block, id: String(block.id || randomUUID()) }));
}

export function renderNewsletter({ title, previewText, blocks }) {
  const rows = normalizeBlocks(blocks).map(renderBlock).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@media only screen and (max-width:480px){.email-outer{padding:0!important}.email-shell{width:100%!important;border-left:0!important;border-right:0!important}.mobile-content-padding{padding:22px 20px!important}.mobile-cards-padding{padding:14px 12px!important}.mobile-card{display:block!important;width:100%!important;box-sizing:border-box!important;padding:12px 8px 20px!important}.mobile-hero-heading{font-size:28px!important;line-height:1.12!important}.mobile-section-heading{font-size:23px!important;line-height:1.15!important}.mobile-button-cell{text-align:center!important}.mobile-button{display:block!important;text-align:center!important;padding:16px 18px!important}.footer-cta{box-sizing:border-box!important}.email-header-title{font-size:30px!important}.email-footer{padding:24px 20px!important}}</style></head><body style="margin:0;padding:0;background:#efe9dd;"><div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(previewText)}</div><table role="presentation" width="100%" bgcolor="#efe9dd"><tr><td class="email-outer" align="center" style="padding:22px 0 44px;"><table class="email-shell" role="presentation" width="640" style="width:640px;max-width:100%;background:#fbfaf6;border:1px solid #d8d0c3;"><tr><td class="mobile-content-padding" style="padding:24px 38px;background:#070707;color:#fff;"><div style="font:700 11px Arial,sans-serif;color:#d05b4f;text-transform:uppercase;letter-spacing:1px;">AHANGAMA</div><div class="email-header-title" style="font:400 36px/1.05 Georgia,serif;text-transform:uppercase;">${escapeHtml(title)}</div></td></tr>${rows}${renderStandardFooter()}</table></td></tr></table></body></html>`;
  const text = [
    title,
    previewText,
    ...blocks.flatMap((block) => [block.heading, block.body]),
    "For Businesses",
    "Want to be featured?",
    "If you run a business, host events, or have an offer for the Ahangama community, we'd love to feature you in next month's newsletter.",
    "To be featured: https://wa.me/94772733202?text=Hi%2C%20I%27d%20like%20to%20be%20featured%20in%20the%20Ahangama%20newsletter",
    "Instagram: https://www.instagram.com/ahangama.pass/",
    "TikTok: https://www.tiktok.com/@ahangama.pass",
    "Website: https://ahangamapass.com",
    "You received this email because you subscribed to Ahangama Pass.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

async function getEmailColumn(tableName) {
  const result = await queryFromEnv(
    DATABASE_ENV,
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  const columns = result.rows.map((row) => row.column_name);
  return (
    ["email", "customer_email", "email_address"].find((name) =>
      columns.includes(name),
    ) || null
  );
}

export async function resolveRecipients(sources = []) {
  const normalizedSources = [
    ...new Set(sources.map((source) => String(source).toLowerCase())),
  ];
  const recipients = new Set();

  for (const source of normalizedSources) {
    if (source === "imported") {
      const result = await query(
        "SELECT email FROM newsletter_imported_recipients WHERE subscribed = TRUE",
      );
      result.rows.forEach((row) =>
        recipients.add(String(row.email).trim().toLowerCase()),
      );
      continue;
    }

    const tableName = AUDIENCE_TABLES[source];
    if (!tableName) continue;
    const emailColumn = await getEmailColumn(tableName);
    if (!emailColumn) continue;
    const result = await queryFromEnv(
      DATABASE_ENV,
      `SELECT DISTINCT lower(trim(${emailColumn}::text)) AS email FROM ${tableName} WHERE NULLIF(trim(${emailColumn}::text), '') IS NOT NULL`,
    );
    result.rows.forEach((row) => recipients.add(row.email));
  }

  return [...recipients].filter((email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  );
}

export async function sendNewsletter({ newsletter, recipients }) {
  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  const fromEmail = String(
    process.env.SENDGRID_FROM_EMAIL || "hello@ahangama.com",
  ).trim();
  const fromName = String(process.env.SENDGRID_FROM_NAME || "Ahangama").trim();
  if (!apiKey) throw new Error("Missing env var: SENDGRID_API_KEY");
  if (!recipients.length) throw new Error("No subscribed recipients found");

  const message = renderNewsletter(newsletter);
  const batches = [];
  for (let index = 0; index < recipients.length; index += 900) {
    batches.push(recipients.slice(index, index + 900));
  }

  const messageIds = [];
  for (const batch of batches) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: batch.map((email) => ({ to: [{ email }] })),
        from: { email: fromEmail, name: fromName },
        subject: newsletter.subject,
        content: [
          { type: "text/plain", value: message.text },
          { type: "text/html", value: message.html },
        ],
        tracking_settings: {
          click_tracking: { enable: true, enable_text: true },
          open_tracking: { enable: true },
          subscription_tracking: { enable: true },
        },
      }),
    });
    if (!response.ok)
      throw new Error(
        `SendGrid request failed (${response.status}): ${await response.text()}`,
      );
    messageIds.push(response.headers.get("x-message-id") || "");
  }

  return {
    recipientCount: recipients.length,
    messageIds: messageIds.filter(Boolean),
  };
}
