import { Pool } from "postgres";

const DATABASE_URL = Deno.env.get("DATABASE_URL");

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Set the DATABASE_URL environment variable to a postgres:// connection string before starting the gateway.",
  );
}

const pool = new Pool(DATABASE_URL, 3, true);

function assertQuery(query: unknown): asserts query is string {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new Error("query must be a non-empty string");
  }
}

export async function queryDB(query: string, ...args: unknown[]) {
  assertQuery(query);
  const client = await pool.connect();
  try {
    const result = await client.queryObject({ text: query, args });
    return result.rows;
  } finally {
    client.release();
  }
}

export async function executeDB(query: string, ...args: unknown[]) {
  assertQuery(query);
  const client = await pool.connect();
  try {
    const result = await client.queryObject({ text: query, args });
    return result;
  } finally {
    client.release();
  }
}