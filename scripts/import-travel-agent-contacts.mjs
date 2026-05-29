import "dotenv/config";
import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { logAdminActivity } from "../netlify/functions/_lib/adminActivity.mjs";
import { getDatabaseConfig } from "../netlify/functions/_lib/db.mjs";
import { normalizeLowerText, normalizeOptionalText } from "../netlify/functions/_lib/crm.mjs";
import {
  TRAVEL_AGENT_COMPANIES_TABLE,
  TRAVEL_AGENT_CONTACTS_TABLE,
  makeTravelAgentCompanyId,
  makeTravelAgentContactId,
  normalizeTravelAgentCompanyName,
  normalizeTravelAgentFullName,
} from "../netlify/functions/_lib/travelAgentCrm.mjs";

const { Pool } = pg;
const DEFAULT_FILE = resolve(
  process.cwd(),
  "src/data/travel_agent_contacts.json",
);

function getArgValue(flag) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) {
    return withEquals.slice(flag.length + 1) || null;
  }

  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSeedRow(row, rowNumber) {
  const companyName = normalizeTravelAgentCompanyName(row.company);
  const firstName = normalizeOptionalText(row.firstName);
  const lastName = normalizeOptionalText(row.lastName);
  const fullName = normalizeTravelAgentFullName(row.fullName);
  const email = normalizeLowerText(row.email);
  const whatsapp = normalizeOptionalText(toArray(row.mobileNumbers)[0]);
  const phone = normalizeOptionalText(toArray(row.landlineNumbers)[0]);
  const emailSent = Boolean(row.emailSent);

  return {
    rowNumber,
    companyName,
    firstName,
    lastName,
    fullName,
    email,
    whatsapp,
    phone,
    emailSent,
    active: true,
  };
}

function printUsage() {
  console.log(
    "Usage: npm run import:travel-agent-contacts -- [--file path] [--apply] [--actor email-or-label]",
  );
}

async function main() {
  const filePath = resolve(getArgValue("--file") || DEFAULT_FILE);
  const apply = process.argv.includes("--apply");
  const actor =
    normalizeLowerText(getArgValue("--actor")) || "import:travel-agent-contacts";

  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("Seed file must be a non-empty JSON array");
  }

  const companiesByKey = new Map();
  const contacts = [];
  const errors = [];
  const seenContacts = new Set();

  parsed.forEach((row, index) => {
    const rowNumber = index + 1;
    try {
      const contact = normalizeSeedRow(row, rowNumber);
      const companyKey = contact.companyName.trim().toLowerCase();
      let company = companiesByKey.get(companyKey);
      if (!company) {
        company = {
          id: makeTravelAgentCompanyId(contact.companyName),
          companyName: contact.companyName,
          notes: null,
          active: true,
        };
        companiesByKey.set(companyKey, company);
      }

      const contactId = makeTravelAgentContactId(company.id, contact.fullName);
      if (seenContacts.has(contactId)) {
        throw new Error(`Duplicate generated contact id: ${contact.fullName}`);
      }
      seenContacts.add(contactId);

      contacts.push({
        id: contactId,
        companyId: company.id,
        ...contact,
      });
    } catch (error) {
      errors.push({
        row: rowNumber,
        error: String(error?.message || error),
      });
    }
  });

  const companies = [...companiesByKey.values()];

  console.log(`Rows parsed: ${parsed.length}`);
  console.log(`Companies ready: ${companies.length}`);
  console.log(`Contacts ready: ${contacts.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length) {
    errors.forEach((entry) => {
      console.log(`  row ${entry.row}: ${entry.error}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("Preview:");
  companies.slice(0, 10).forEach((company) => {
    const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
    console.log(`  ${company.companyName}: ${companyContacts.length} people`);
  });

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to write to the database.");
    return;
  }

  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const company of companies) {
      await client.query(
        `
          INSERT INTO ${TRAVEL_AGENT_COMPANIES_TABLE} (
            id, company_name, notes, active, created_by, updated_by, deleted_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NULL)
          ON CONFLICT (id)
          DO UPDATE SET
            company_name = EXCLUDED.company_name,
            notes = EXCLUDED.notes,
            active = EXCLUDED.active,
            updated_by = EXCLUDED.updated_by,
            deleted_at = NULL
        `,
        [
          company.id,
          company.companyName,
          company.notes,
          company.active,
          actor,
          actor,
        ],
      );
    }

    for (const contact of contacts) {
      await client.query(
        `
          INSERT INTO ${TRAVEL_AGENT_CONTACTS_TABLE} (
            id, company_id, first_name, last_name, full_name,
            email, whatsapp, phone, notes,
            email_sent, active, created_by, updated_by, deleted_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, NULL
          )
          ON CONFLICT (id)
          DO UPDATE SET
            company_id = EXCLUDED.company_id,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            whatsapp = EXCLUDED.whatsapp,
            phone = EXCLUDED.phone,
            notes = EXCLUDED.notes,
            email_sent = EXCLUDED.email_sent,
            active = EXCLUDED.active,
            updated_by = EXCLUDED.updated_by,
            deleted_at = NULL
        `,
        [
          contact.id,
          contact.companyId,
          contact.firstName,
          contact.lastName,
          contact.fullName,
          contact.email,
          contact.whatsapp,
          contact.phone,
          null,
          contact.emailSent,
          contact.active,
          actor,
          actor,
        ],
      );
    }

    await logAdminActivity({
      action: "import",
      actorEmail: actor,
      entityType: "travel_agent_import",
      entityId: `travel-agent-import-${Date.now().toString(36)}`,
      entityName: `Imported ${contacts.length} travel-agent contacts`,
      details: {
        source: "seed_json",
        sourceFile: basename(filePath),
        companiesImported: companies.length,
        contactsImported: contacts.length,
      },
      execute: client.query.bind(client),
    });

    await client.query("COMMIT");
    console.log(`Imported ${companies.length} companies and ${contacts.length} contacts.`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures.
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