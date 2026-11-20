import "server-only";

import { insertAdminAudit } from "@/lib/admin-audit";
import { getPool } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export const SERVICE_PRODUCTS = ["wallet"] as const;
export type ServiceProduct = (typeof SERVICE_PRODUCTS)[number];

export type ServiceClientRow = {
  clientId: string;
  product: ServiceProduct;
  createdAt: string;
  revokedAt: string | null;
  createdBy: string | null;
};

export async function listServiceClients(): Promise<ServiceClientRow[]> {
  const { rows } = await getPool().query<ServiceClientRow>(
    `select c.client_id as "clientId", c.product, c.created_at as "createdAt",
            c.revoked_at as "revokedAt", u.email as "createdBy"
     from pay_service_clients c left join users u on u.id = c.created_by
     order by c.created_at desc, c.client_id`,
  );
  return rows;
}

export async function getServiceClientsEnv(): Promise<string> {
  const { rows } = await getPool().query<{ clientId: string; product: ServiceProduct }>(
    `select client_id as "clientId", product
     from pay_service_clients
     where revoked_at is null
     order by client_id`,
  );
  return rows.map((row) => `${row.clientId}=${row.product}`).join(",");
}

export function validateServiceClient(clientId: string, product: string): string | null {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(clientId)) {
    return "Client ID must be 1-64 characters using letters, numbers, dots, underscores or hyphens.";
  }
  if (clientId === "pay") return "Pay's own client cannot be granted service access.";
  if (!(SERVICE_PRODUCTS as readonly string[]).includes(product)) {
    return "Only the wallet product can be granted.";
  }
  return null;
}

export async function addServiceClient(
  clientId: string,
  product: ServiceProduct,
  audit: { admin: SessionUser; request: Request; reason: string },
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const before = await client.query(
      "select revoked_at as \"revokedAt\" from pay_service_clients where client_id = $1",
      [clientId],
    );
    await client.query(
      `insert into pay_service_clients (client_id, product, created_by)
       values ($1, $2, $3)
       on conflict (client_id) do update
         set product = excluded.product, revoked_at = null, created_by = excluded.created_by`,
      [clientId, product, audit.admin.id],
    );
    await insertAdminAudit(client, {
      ...audit,
      action: "pay.service_client.granted",
      resource: `pay.service_client.${clientId}`,
      before: before.rows[0] ?? null,
      after: { clientId, product, revokedAt: null },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("Could not roll back service client grant:", rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeServiceClient(
  clientId: string,
  audit: { admin: SessionUser; request: Request; reason: string },
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const before = await client.query<{ product: ServiceProduct; revokedAt: string | null }>(
      `select product, revoked_at as "revokedAt"
       from pay_service_clients where client_id = $1`,
      [clientId],
    );
    if (!before.rows[0] || before.rows[0].revokedAt) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      "update pay_service_clients set revoked_at = now() where client_id = $1",
      [clientId],
    );
    await insertAdminAudit(client, {
      ...audit,
      action: "pay.service_client.revoked",
      resource: `pay.service_client.${clientId}`,
      before: before.rows[0],
      after: { ...before.rows[0], revokedAt: "now" },
    });
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("Could not roll back service client revocation:", rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}
