import bcrypt from "bcryptjs";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;

async function createAdmin() {
  loadEnvConfig(process.cwd());

  const connectionString = process.env.DATABASE_URL;
  const fullname = process.env.PANEL_ADMIN_FULLNAME?.trim();
  const email = process.env.PANEL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PANEL_ADMIN_PASSWORD;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }
  if (!fullname || !email || !password) {
    throw new Error(
      "PANEL_ADMIN_FULLNAME, PANEL_ADMIN_EMAIL, and PANEL_ADMIN_PASSWORD must be configured",
    );
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("PANEL_ADMIN_EMAIL must be a valid email address");
  }
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error(
      "PANEL_ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pool = new Pool({ connectionString });

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (fullname, email, password, is_admin)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [fullname, email, passwordHash],
    );

    if (rows.length === 0) {
      throw new Error("A user with this email already exists; no account was changed");
    }

    console.log("Created the initial admin account.");
    console.log("Remove PANEL_ADMIN_PASSWORD from your local environment file.");
  } finally {
    await pool.end();
  }
}

createAdmin().catch((error) => {
  console.error("Admin account creation failed:", error);
  process.exitCode = 1;
});
