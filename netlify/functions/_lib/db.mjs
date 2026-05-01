import pg from "pg";
const { Pool } = pg;

let pool;

function getDatabaseConnectionString() {
  const rawValue = String(process.env.DATABASE_URL || "").trim();
  if (!rawValue) {
    throw new Error("Missing env var: DATABASE_URL");
  }

  const url = new URL(rawValue);
  const sslMode = String(url.searchParams.get("sslmode") || "").toLowerCase();

  if (["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }

  return rawValue;
}

export function getDatabaseConfig() {
  return {
    connectionString: getDatabaseConnectionString(),
  };
}

function getPool() {
  if (!pool) {
    pool = new Pool(getDatabaseConfig());
  }
  return pool;
}

export async function query(text, params = []) {
  const p = getPool();
  return p.query(text, params);
}
