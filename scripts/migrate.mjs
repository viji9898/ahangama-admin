import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const r = await client.query(`SELECT filename FROM schema_migrations;`);
  return new Set(r.rows.map((x) => x.filename));
}

async function applyOneMigration(client, filename, sql) {
  // One migration = one transaction
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING;`,
      [filename],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

async function main() {
  const databaseUrl = mustGetEnv("DATABASE_URL");

  const files = listSqlFiles(MIGRATIONS_DIR);
  if (files.length === 0) {
    console.log("No migrations found in /migrations");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    console.log(`Pending migrations (${pending.length}):`);
    for (const f of pending) console.log(`- ${f}`);

    for (const f of pending) {
      const fullPath = path.join(MIGRATIONS_DIR, f);
      const sql = fs.readFileSync(fullPath, "utf8");
      if (!sql.trim()) {
        console.log(`Skipping empty migration: ${f}`);
        continue;
      }
      console.log(`Applying: ${f}`);
      await applyOneMigration(client, f, sql);
      console.log(`Applied: ${f}`);
    }

    console.log("All pending migrations applied.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err?.message || err);
  process.exit(1);
});
