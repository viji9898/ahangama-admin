import pg from "pg";
const { Pool } = pg;

const pools = new Map();

function getDatabaseConnectionString(envVarName = "DATABASE_URL") {
  const rawValue = String(process.env[envVarName] || "").trim();
  if (!rawValue) {
    throw new Error(`Missing env var: ${envVarName}`);
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

export function getDatabaseConfigForEnv(envVarName) {
  return {
    connectionString: getDatabaseConnectionString(envVarName),
  };
}

function getPool(envVarName = "DATABASE_URL") {
  if (!pools.has(envVarName)) {
    pools.set(envVarName, new Pool(getDatabaseConfigForEnv(envVarName)));
  }
  return pools.get(envVarName);
}

export async function query(text, params = []) {
  const p = getPool();
  return p.query(text, params);
}

export async function queryFromEnv(envVarName, text, params = []) {
  const p = getPool(envVarName);
  return p.query(text, params);
}
