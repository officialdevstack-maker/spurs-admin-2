import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool };
let productionPool: Pool | undefined;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const existingPool = globalForPg.pgPool ?? productionPool;
  if (existingPool) return existingPool;

  const pool = new Pool({ connectionString, max: 5 });
  if (process.env.NODE_ENV === "production") {
    productionPool = pool;
  } else {
    globalForPg.pgPool = pool;
  }
  return pool;
}
