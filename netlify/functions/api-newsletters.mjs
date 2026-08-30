import { randomUUID } from "node:crypto";
import { requireAdmin } from "./_lib/auth.mjs";
import { query } from "./_lib/db.mjs";
import {
  normalizeBlocks,
  renderNewsletter,
  resolveRecipients,
  sendNewsletter,
} from "./_lib/newsletters.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

function toNewsletter(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    previewText: row.preview_text || "",
    status: row.status,
    blocks: row.blocks || [],
    audienceSources: row.audience_sources || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
  };
}

async function getNewsletter(id) {
  const result = await query("SELECT * FROM newsletters WHERE id = $1", [id]);
  if (!result.rows[0]) {
    throw Object.assign(new Error("Newsletter not found"), { statusCode: 404 });
  }
  return toNewsletter(result.rows[0]);
}

function validateCampaign(body) {
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  if (!title)
    throw Object.assign(new Error("Title is required"), { statusCode: 400 });
  if (!subject)
    throw Object.assign(new Error("Subject is required"), { statusCode: 400 });
  return {
    title,
    subject,
    previewText: String(body.previewText || "").trim(),
    blocks: normalizeBlocks(body.blocks || []),
    audienceSources: [
      ...new Set(
        (body.audienceSources || []).map((value) =>
          String(value).toLowerCase(),
        ),
      ),
    ].filter((value) =>
      ["circle", "guest", "hospo", "imported"].includes(value),
    ),
  };
}

async function listNewsletters() {
  const result = await query(
    "SELECT * FROM newsletters ORDER BY updated_at DESC LIMIT 100",
  );
  return result.rows.map(toNewsletter);
}

async function saveNewsletter(body, actorEmail) {
  const campaign = validateCampaign(body);
  const id = String(body.id || randomUUID());
  const existing = await query("SELECT status FROM newsletters WHERE id = $1", [
    id,
  ]);
  if (existing.rows[0]?.status === "sent") {
    throw Object.assign(new Error("Sent newsletters cannot be edited"), {
      statusCode: 409,
    });
  }

  const result = await query(
    `
      INSERT INTO newsletters (
        id, title, subject, preview_text, blocks, audience_sources,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::text[], $7, $7)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        subject = EXCLUDED.subject,
        preview_text = EXCLUDED.preview_text,
        blocks = EXCLUDED.blocks,
        audience_sources = EXCLUDED.audience_sources,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `,
    [
      id,
      campaign.title,
      campaign.subject,
      campaign.previewText,
      JSON.stringify(campaign.blocks),
      campaign.audienceSources,
      actorEmail,
    ],
  );
  return toNewsletter(result.rows[0]);
}

async function importRecipients(body) {
  const listName = String(body.listName || "Imported").trim() || "Imported";
  const values = Array.isArray(body.recipients) ? body.recipients : [];
  let imported = 0;
  const rejected = [];

  for (const value of values) {
    const email = String(typeof value === "string" ? value : value?.email || "")
      .trim()
      .toLowerCase();
    const name =
      String(typeof value === "object" ? value?.name || "" : "").trim() || null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (email) rejected.push(email);
      continue;
    }
    await query(
      `
        INSERT INTO newsletter_imported_recipients (id, email, name, list_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, newsletter_imported_recipients.name),
          list_name = EXCLUDED.list_name,
          subscribed = TRUE,
          updated_at = NOW()
      `,
      [randomUUID(), email, name, listName],
    );
    imported += 1;
  }
  return { imported, rejected };
}

export async function handler(event) {
  try {
    const actor = requireAdmin(event);
    const actorEmail = String(actor?.email || "")
      .trim()
      .toLowerCase();
    const id = String(event.queryStringParameters?.id || "").trim();

    if (event.httpMethod === "GET") {
      if (!id)
        return json(200, { ok: true, newsletters: await listNewsletters() });
      const newsletter = await getNewsletter(id);
      const preview = renderNewsletter(newsletter);
      const recipients = await resolveRecipients(newsletter.audienceSources);
      return json(200, {
        ok: true,
        newsletter,
        preview,
        recipientCount: recipients.length,
      });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const body = parseBody(event);
    const action = String(body.action || "save");

    if (action === "save") {
      return json(200, {
        ok: true,
        newsletter: await saveNewsletter(body, actorEmail),
      });
    }

    if (action === "preview") {
      const campaign = validateCampaign(body);
      return json(200, { ok: true, preview: renderNewsletter(campaign) });
    }

    if (action === "import") {
      return json(200, { ok: true, ...(await importRecipients(body)) });
    }

    if (action === "count") {
      const recipients = await resolveRecipients(body.audienceSources || []);
      return json(200, { ok: true, recipientCount: recipients.length });
    }

    if (action === "test" || action === "send") {
      if (!id)
        throw Object.assign(new Error("Newsletter id is required"), {
          statusCode: 400,
        });
      const newsletter = await getNewsletter(id);
      if (action === "send" && body.confirmSubject !== newsletter.subject) {
        throw Object.assign(new Error("Subject confirmation does not match"), {
          statusCode: 400,
        });
      }
      if (action === "send" && newsletter.status === "sent") {
        throw Object.assign(new Error("Newsletter has already been sent"), {
          statusCode: 409,
        });
      }

      const recipients =
        action === "test"
          ? [actorEmail]
          : await resolveRecipients(newsletter.audienceSources);
      const result = await sendNewsletter({ newsletter, recipients });

      if (action === "send") {
        await query(
          `
            WITH recorded_send AS (
              INSERT INTO newsletter_sends (
              id, newsletter_id, subject, audience_sources, recipient_count,
              sent_by, sendgrid_message_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING newsletter_id
            )
            UPDATE newsletters
            SET status = 'sent', sent_at = NOW(), updated_at = NOW()
            WHERE id = (SELECT newsletter_id FROM recorded_send)
          `,
          [
            randomUUID(),
            newsletter.id,
            newsletter.subject,
            newsletter.audienceSources,
            result.recipientCount,
            actorEmail,
            result.messageIds.join(","),
          ],
        );
      }

      return json(200, { ok: true, test: action === "test", ...result });
    }

    throw Object.assign(new Error("Unknown action"), { statusCode: 400 });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
