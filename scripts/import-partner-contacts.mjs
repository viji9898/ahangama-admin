import "dotenv/config";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { logAdminActivity } from "../netlify/functions/_lib/adminActivity.mjs";
import { parseCsv } from "../netlify/functions/_lib/csv.mjs";
import {
  PARTNER_CONTACTS_TABLE,
  makePartnerContactId,
  normalizeContactRole,
  normalizeLowerText,
  normalizeOptionalText,
} from "../netlify/functions/_lib/crm.mjs";
import { getDatabaseConfig } from "../netlify/functions/_lib/db.mjs";
import { VENUES_TABLE } from "../netlify/functions/_lib/venues260414.mjs";

const { Pool } = pg;

function getArgValue(flag) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) {
    return withEquals.slice(flag.length + 1) || null;
  }

  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalizeCsvKey(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(row, ...keys) {
  const wantedKeys = new Set(keys.map((key) => normalizeCsvKey(key)));

  for (const [rowKey, rowValue] of Object.entries(row)) {
    if (wantedKeys.has(normalizeCsvKey(rowKey))) {
      return rowValue;
    }
  }

  return undefined;
}

function asBoolean(value, fallback = false) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function inferContactRole(row) {
  const explicitRole = normalizeOptionalText(pick(row, "role"));
  if (explicitRole) {
    return normalizeContactRole(explicitRole, "other");
  }

  const notes = normalizeLowerText(pick(row, "notes"));
  if (!notes) {
    return "other";
  }

  if (notes === "owner" || notes.endsWith(" owner")) {
    return "owner";
  }

  if (notes.includes("manager")) {
    return "manager";
  }

  return "other";
}

function normalizeContactRow(row, rowNumber) {
  const venueId = normalizeLowerText(pick(row, "venue_id", "venueId"));
  const contactName = normalizeOptionalText(
    pick(row, "contact_name", "contactName"),
  );
  const role = inferContactRole(row);
  const phone = normalizeOptionalText(pick(row, "phone"));
  const whatsapp = normalizeOptionalText(pick(row, "whatsapp")) || phone;
  const email = normalizeLowerText(pick(row, "email"));
  const notes = normalizeOptionalText(pick(row, "notes"));

  if (!venueId || !contactName) {
    throw new Error("venue_id and contact_name are required");
  }

  return {
    rowNumber,
    id:
      normalizeLowerText(pick(row, "id")) ||
      makePartnerContactId(venueId, role, contactName),
    venueId,
    contactName,
    role,
    email,
    whatsapp,
    phone,
    notes,
    isPrimary: asBoolean(pick(row, "is_primary", "isPrimary"), false),
    active: asBoolean(pick(row, "active"), true),
  };
}

function printUsage() {
  console.log(
    "Usage: npm run import:partner-contacts -- --file <csv-path> [--apply] [--actor <email-or-label>]",
  );
}

async function main() {
  const filePath = getArgValue("--file") || process.argv[2] || null;
  const apply = process.argv.includes("--apply");
  const actor =
    normalizeLowerText(getArgValue("--actor")) || "import:partner-contacts";

  if (!filePath) {
    printUsage();
    throw new Error("Missing required --file argument");
  }

  const csv = await readFile(filePath, "utf8");
  const parsedRows = parseCsv(csv);

  if (!parsedRows.length) {
    throw new Error("CSV file is empty");
  }

  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();

  try {
    const venueResult = await client.query(
      `SELECT id FROM ${VENUES_TABLE} WHERE deleted_at IS NULL`,
    );
    const validVenueIds = new Set(venueResult.rows.map((row) => row.id));

    const contacts = [];
    const errors = [];
    const seenIds = new Map();

    parsedRows.forEach((row, index) => {
      const rowNumber = index + 2;

      try {
        const contact = normalizeContactRow(row, rowNumber);

        if (!validVenueIds.has(contact.venueId)) {
          throw new Error(`Unknown venue_id: ${contact.venueId}`);
        }

        const existingRow = seenIds.get(contact.id);
        if (existingRow) {
          throw new Error(
            `Duplicate generated contact id also used by CSV row ${existingRow}`,
          );
        }

        seenIds.set(contact.id, rowNumber);
        contacts.push(contact);
      } catch (error) {
        errors.push({
          row: rowNumber,
          error: String(error?.message || error),
        });
      }
    });

    console.log(`Rows parsed: ${parsedRows.length}`);
    console.log(`Rows ready: ${contacts.length}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length) {
      console.log("Validation errors:");
      errors.forEach((entry) => {
        console.log(`  row ${entry.row}: ${entry.error}`);
      });
      process.exitCode = 1;
      return;
    }

    console.log("Preview:");
    contacts.slice(0, 10).forEach((contact) => {
      console.log(
        `  row ${contact.rowNumber}: ${contact.venueId} -> ${contact.contactName} (${contact.role})`,
      );
    });

    if (!apply) {
      console.log(
        "Dry run complete. Re-run with --apply to write to the database.",
      );
      return;
    }

    await client.query("BEGIN");

    for (const contact of contacts) {
      await client.query(
        `
          INSERT INTO ${PARTNER_CONTACTS_TABLE} (
            id, venue_id, reference_key, contact_name, role,
            email, whatsapp, phone, notes,
            is_primary, active, created_by, updated_by, deleted_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, NULL
          )
          ON CONFLICT (id)
          DO UPDATE SET
            venue_id = EXCLUDED.venue_id,
            contact_name = EXCLUDED.contact_name,
            role = EXCLUDED.role,
            email = EXCLUDED.email,
            whatsapp = EXCLUDED.whatsapp,
            phone = EXCLUDED.phone,
            notes = EXCLUDED.notes,
            is_primary = EXCLUDED.is_primary,
            active = EXCLUDED.active,
            updated_by = EXCLUDED.updated_by,
            deleted_at = NULL
        `,
        [
          contact.id,
          contact.venueId,
          null,
          contact.contactName,
          contact.role,
          contact.email,
          contact.whatsapp,
          contact.phone,
          contact.notes,
          contact.isPrimary,
          contact.active,
          actor,
          actor,
        ],
      );
    }

    await logAdminActivity({
      action: "import",
      actorEmail: actor,
      entityType: "contact",
      entityId: `contact-import-${Date.now().toString(36)}`,
      entityName: `Imported ${contacts.length} contacts`,
      details: {
        source: "batch_import",
        sourceFile: basename(filePath),
        importedCount: contacts.length,
      },
      execute: client.query.bind(client),
    });

    await client.query("COMMIT");
    console.log(`Imported ${contacts.length} contacts.`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors after validation-only runs.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
