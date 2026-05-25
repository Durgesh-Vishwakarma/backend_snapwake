import pg from "pg";
import { DATABASE_URL, NODE_ENV } from "./env.js";

const { Pool } = pg;

function getDatabaseUrl() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return DATABASE_URL;
}

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl:
    NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function testDatabaseConnection() {
  const result = await query("SELECT NOW() AS now");

  return result.rows[0]?.now;
}
