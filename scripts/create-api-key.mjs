import { createHash, randomBytes } from "node:crypto";

import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;

async function createApiKey() {
  loadEnvConfig(process.cwd());

  const connectionString = process.env.DATABASE_URL;
  const name = process.env.API_KEY_NAME?.trim();
  if (!connectionString) throw new Error("DATABASE_URL must be configured");
  if (!name || name.length > 120) {
    throw new Error("API_KEY_NAME is required (max 120 characters)");
  }

  const key = `spk_${randomBytes(32).toString("base64url")}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const pool = new Pool({ connectionString });

  try {
    await pool.query("INSERT INTO api_keys (name, key_hash) VALUES ($1, $2)", [name, keyHash]);
    console.log(`API key for "${name}" (shown once, store it now):\n\n${key}\n`);
  } finally {
    await pool.end();
  }
}

createApiKey().catch((error) => {
  console.error("API key creation failed:", error);
  process.exitCode = 1;
});
