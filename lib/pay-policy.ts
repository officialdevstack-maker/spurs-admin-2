import "server-only";

import type { PoolClient } from "pg";

import { insertAdminAudit } from "@/lib/admin-audit";
import { getPool } from "@/lib/db";
import { DEFAULT_POLICY, parsePolicy, type PayPolicy, type PayPolicyVersion } from "@/lib/pay-policy-schema";
import type { SessionUser } from "@/lib/session";

export type ActivePolicy = { version: number; config: PayPolicy };

export async function getActivePolicy(client?: PoolClient): Promise<ActivePolicy> {
  const sql = "select version, config from pay_config_versions order by version desc limit 1";
  const { rows } = client
    ? await client.query<{ version: number; config: unknown }>(sql)
    : await getPool().query<{ version: number; config: unknown }>(sql);
  const row = rows[0];
  if (!row) return { version: 0, config: DEFAULT_POLICY };
  const parsed = parsePolicy(row.config);
  if (typeof parsed === "string") throw new Error(`Stored Pay policy is invalid: ${parsed}`);
  return { version: row.version, config: parsed };
}

export async function listPolicyVersions(limit = 50): Promise<PayPolicyVersion[]> {
  const { rows } = await getPool().query<PayPolicyVersion>(
    `select v.version, v.reason, v.rolled_back_from as "rolledBackFrom",
            v.created_at as "createdAt", u.email as "createdBy"
     from pay_config_versions v left join users u on u.id = v.created_by
     order by v.version desc limit $1`,
    [limit],
  );
  return rows;
}

export async function getPolicyVersion(version: number): Promise<PayPolicy | null> {
  const { rows } = await getPool().query<{ config: unknown }>(
    "select config from pay_config_versions where version = $1",
    [version],
  );
  if (!rows[0]) return null;
  const parsed = parsePolicy(rows[0].config);
  return typeof parsed === "string" ? null : parsed;
}

export async function savePayPolicy(
  policy: PayPolicy,
  audit: { admin: SessionUser; request: Request; reason: string },
  rolledBackFrom?: number,
): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("select pg_advisory_xact_lock(719402, 4)");
    const before = await getActivePolicy(client);
    const next = before.version + 1;
    await client.query(
      `insert into pay_config_versions (version, config, reason, rolled_back_from, created_by)
       values ($1, $2::jsonb, $3, $4, $5)`,
      [next, JSON.stringify(policy), audit.reason, rolledBackFrom ?? null, audit.admin.id],
    );
    await insertAdminAudit(client, {
      ...audit,
      action: rolledBackFrom ? "pay.policy.rolled_back" : "pay.policy.updated",
      resource: "pay.policy",
      before: { version: before.version, config: before.config },
      after: { version: next, config: policy },
    });
    await client.query("COMMIT");
    return next;
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("Could not roll back Pay policy change:", rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}
