import "server-only";

import type { PoolClient } from "pg";

import { insertAdminAudit } from "@/lib/admin-audit";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getPool } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { getActivePolicy } from "@/lib/pay-policy";
import { getServiceClientsEnv } from "@/lib/pay-service-clients";

export type PayProvider = "sandbox" | "flutterwave";

const SERVICE_CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function normaliseServiceClients(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").join(",");
  }
  return "";
}

function validateServiceClientValue(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";

  for (const entry of cleaned.split(",").map((item) => item.trim()).filter(Boolean)) {
    const [clientId, product, extra] = entry.split("=").map((part) => part.trim());
    if (!clientId || !product || extra !== undefined) {
      throw new Error(`Invalid service client grant "${entry}". Use clientId=product.`);
    }
    if (!SERVICE_CLIENT_ID_PATTERN.test(clientId)) {
      throw new Error(`Invalid service client ID "${clientId}".`);
    }
    if (product !== "wallet") {
      throw new Error(`Service client "${clientId}" cannot act as "${product}".`);
    }
    if (clientId === "pay") {
      throw new Error('The Pay client cannot be granted service access.');
    }
  }

  return cleaned;
}

type StoredPayProviderSettings = {
  provider?: PayProvider;
  flutterwaveSecretKeyEnc?: string;
  flutterwaveWebhookSecretEnc?: string;
  serviceClients?: string;
};

export type PayProviderSettings = {
  provider: PayProvider;
  flutterwaveSecretKeySet: boolean;
  flutterwaveWebhookSecretSet: boolean;
  serviceClients: string;
};

async function readStored(client?: PoolClient): Promise<StoredPayProviderSettings> {
  const result = client
    ? await client.query<{ value: unknown }>("select value from settings where key = 'pay'")
    : await getPool().query<{ value: unknown }>("select value from settings where key = 'pay'");
  const { rows } = result;
  const value = rows[0]?.value;
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored Pay settings have an invalid format");
  }

  const stored = value as Record<string, unknown>;
  const provider = stored.provider;
  if (provider !== undefined && provider !== "sandbox" && provider !== "flutterwave") {
    throw new Error("Stored Pay provider is not supported");
  }

  const encryptedSecretKey = stored.flutterwaveSecretKeyEnc;
  const encryptedWebhookSecret = stored.flutterwaveWebhookSecretEnc;
  if (
    (encryptedSecretKey !== undefined && typeof encryptedSecretKey !== "string") ||
    (encryptedWebhookSecret !== undefined && typeof encryptedWebhookSecret !== "string")
  ) {
    throw new Error("Stored Pay credentials have an invalid format");
  }

  const serviceClients = normaliseServiceClients(stored.serviceClients);

  return {
    provider,
    flutterwaveSecretKeyEnc: encryptedSecretKey,
    flutterwaveWebhookSecretEnc: encryptedWebhookSecret,
    serviceClients,
  };
}

function publicSettings(stored: StoredPayProviderSettings): PayProviderSettings {
  const { provider, flutterwaveSecretKeyEnc, flutterwaveWebhookSecretEnc, serviceClients } = stored;
  return {
    provider: provider ?? "sandbox",
    flutterwaveSecretKeySet: Boolean(flutterwaveSecretKeyEnc),
    flutterwaveWebhookSecretSet: Boolean(flutterwaveWebhookSecretEnc),
    serviceClients: normaliseServiceClients(serviceClients),
  };
}

export async function getPayProviderSettings(): Promise<PayProviderSettings> {
  return publicSettings(await readStored());
}

export async function getPayProviderConfig(): Promise<Record<string, string>> {
  const { provider, flutterwaveSecretKeyEnc, flutterwaveWebhookSecretEnc } = await readStored();
  const activePolicy = await getActivePolicy();
  const managedServiceClients = await getServiceClientsEnv();
  const policy = activePolicy.config;
  return {
    PAY_PROVIDER: provider ?? "sandbox",
    PAY_FLUTTERWAVE_SECRET_KEY: flutterwaveSecretKeyEnc
      ? decryptSecret(flutterwaveSecretKeyEnc)
      : "",
    PAY_FLUTTERWAVE_WEBHOOK_SECRET: flutterwaveWebhookSecretEnc
      ? decryptSecret(flutterwaveWebhookSecretEnc)
      : "",
    SERVICE_CLIENTS: managedServiceClients,
    PAY_POLICY: JSON.stringify({ version: activePolicy.version, ...policy }),
    PAY_CARD_FUNDING_BPS: String(policy.fees.cardFundingBps),
    PAY_PER_TRANSFER_KOBO: policy.limits.perTransferKobo,
    PAY_DAILY_DEBIT_KOBO: policy.limits.dailyDebitKobo,
    PAY_MAX_BALANCE_KOBO: policy.limits.maxBalanceKobo,
    PAY_CHECKOUT_MAX_AMOUNT_KOBO: policy.limits.maxCheckoutAmountKobo,
    PAY_CHECKOUT_SESSION_TTL_SECONDS: String(policy.checkout.sessionTtlSeconds),
    PAY_BANK_TRANSFER_GRACE_SECONDS: String(policy.checkout.attemptGraceSeconds),
    PAY_CARD_TOKENIZATION: policy.methods.card ? "true" : "false",
  };
}

export async function savePayProviderSettings(
  input: {
    provider: PayProvider;
    secretKey?: string;
    webhookSecret?: string;
    clearSecretKey?: boolean;
    clearWebhookSecret?: boolean;
    serviceClients?: string;
  },
  audit: { admin: SessionUser; request: Request; reason: string },
) {
  const secretKeyEnc = input.secretKey ? encryptSecret(input.secretKey) : null;
  const webhookSecretEnc = input.webhookSecret ? encryptSecret(input.webhookSecret) : null;
  const serviceClients = input.serviceClients !== undefined ? validateServiceClientValue(input.serviceClients) : undefined;
  const value = JSON.stringify({
    provider: input.provider,
    ...(serviceClients ? { serviceClients } : {}),
  });
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("select pg_advisory_xact_lock(719402, 3)");
    const before = publicSettings(await readStored(client));
    await client.query(
      `insert into settings (key, value, updated_by, updated_at)
       values (
         'pay',
         $1::jsonb || CASE WHEN $2::text IS NULL THEN '{}'::jsonb
                           ELSE jsonb_build_object('flutterwaveSecretKeyEnc', $2::text) END ||
         CASE WHEN $3::text IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('flutterwaveWebhookSecretEnc', $3::text) END,
         $5,
         now()
       )
       on conflict (key) do update
         set value = $1::jsonb ||
             CASE
               WHEN $4::boolean THEN '{}'::jsonb
               WHEN $2::text IS NOT NULL
                 THEN jsonb_build_object('flutterwaveSecretKeyEnc', $2::text)
               WHEN settings.value ? 'flutterwaveSecretKeyEnc'
                 THEN jsonb_build_object(
                   'flutterwaveSecretKeyEnc',
                   settings.value->'flutterwaveSecretKeyEnc'
                 )
               ELSE '{}'::jsonb
             END ||
             CASE
               WHEN $6::boolean THEN '{}'::jsonb
               WHEN $3::text IS NOT NULL
                 THEN jsonb_build_object('flutterwaveWebhookSecretEnc', $3::text)
               WHEN settings.value ? 'flutterwaveWebhookSecretEnc'
                 THEN jsonb_build_object(
                   'flutterwaveWebhookSecretEnc',
                   settings.value->'flutterwaveWebhookSecretEnc'
                 )
               ELSE '{}'::jsonb
             END,
             updated_by = $5,
             updated_at = now()`,
      [
        value,
        secretKeyEnc,
        webhookSecretEnc,
        input.clearSecretKey === true,
        audit.admin.id,
        input.clearWebhookSecret === true,
      ],
    );
    const after = publicSettings(await readStored(client));
    await insertAdminAudit(client, {
      ...audit,
      action: "pay.provider_settings.updated",
      resource: "pay.provider_settings",
      before,
      after,
    });
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Could not roll back Pay provider settings:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
