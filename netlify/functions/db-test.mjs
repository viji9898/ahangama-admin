import { Client } from "pg";
import { getDatabaseConfig } from "./_lib/db.mjs";

export async function handler() {
  const client = new Client(getDatabaseConfig());

  try {
    await client.connect();
    const result = await client.query("SELECT NOW()");
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, time: result.rows[0] }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await client.end();
  }
}
