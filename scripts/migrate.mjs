import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;
const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));

async function runMigrations() {
  loadEnvConfig(process.cwd());

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(719402, 1)");
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_schema_migrations (
          migration_name text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const files = (await readdir(migrationsDirectory))
        .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
        .sort((a, b) => a.localeCompare(b));
      const { rows } = await client.query(
        "SELECT migration_name FROM admin_schema_migrations",
      );
      const applied = new Set(rows.map((row) => row.migration_name));
      let appliedCount = 0;

      for (const name of files) {
        if (applied.has(name)) continue;

        const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
        await client.query(sql);
        await client.query(
          "INSERT INTO admin_schema_migrations (migration_name) VALUES ($1)",
          [name],
        );
        console.log(`Applied migration: ${name}`);
        appliedCount += 1;
      }

      await client.query("COMMIT");
      if (appliedCount === 0) console.log("Database is already up to date.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client?.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
