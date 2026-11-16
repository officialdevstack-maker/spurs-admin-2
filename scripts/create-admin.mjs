import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;

async function createAdmin() {
  loadEnvConfig(process.cwd());

  const connectionString = process.env.DATABASE_URL;
  const fullname = process.env.PANEL_ADMIN_FULLNAME?.trim();
  const email = process.env.PANEL_ADMIN_EMAIL?.trim().toLowerCase();

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }
  if (!fullname || !email) {
    throw new Error("PANEL_ADMIN_FULLNAME and PANEL_ADMIN_EMAIL must be configured");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("PANEL_ADMIN_EMAIL must be a valid email address");
  }
  const pool = new Pool({ connectionString });

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (fullname, email, is_admin, role_id)
       VALUES ($1, $2, TRUE,
         (SELECT id FROM admin_roles WHERE lower(name) = 'super admin'))
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [fullname, email],
    );

    if (rows.length === 0) {
      throw new Error("A user with this email already exists; no account was changed");
    }

    console.log("Created the initial admin account.");
    console.log("The account must exist in Spurs Accounts with this verified email.");
  } finally {
    await pool.end();
  }
}

createAdmin().catch((error) => {
  console.error("Admin account creation failed:", error);
  process.exitCode = 1;
});
