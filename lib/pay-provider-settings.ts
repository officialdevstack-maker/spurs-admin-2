import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getPool } from "@/lib/db";

export type PayProvider = "sandbox" | "flutterwave";

type StoredPayProviderSettings = {
  provider?: PayProvider;
  flutterwaveSecretKeyEnc?: string;
  flutterwaveWebhookSecretEnc?: string;
};

export type PayProviderSettings = {
  provider: PayProvider;
  flutterwaveSecretKeySet: boolean;
  flutterwaveWebhookSecretSet: boolean;
};

async function readStored(): Promise<StoredPayProviderSettings> {
  const { rows } = await getPool().query<{ value: unknown }>(
    "select value from settings where key = 'pay'",
  );
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

  return {
    provider,
    flutterwaveSecretKeyEnc: encryptedSecretKey,
    flutterwaveWebhookSecretEnc: encryptedWebhookSecret,
  };
}

export async function getPayProviderSettings(): Promise<PayProviderSettings> {
  const { provider, flutterwaveSecretKeyEnc, flutterwaveWebhookSecretEnc } = await readStored();
  return {
    provider: provider ?? "sandbox",
    flutterwaveSecretKeySet: Boolean(flutterwaveSecretKeyEnc),
    flutterwaveWebhookSecretSet: Boolean(flutterwaveWebhookSecretEnc),
  };
}

export async function getPayProviderConfig(): Promise<Record<string, string>> {
  const { provider, flutterwaveSecretKeyEnc, flutterwaveWebhookSecretEnc } = await readStored();
  return {
    PAY_PROVIDER: provider ?? "sandbox",
    PAY_FLUTTERWAVE_SECRET_KEY: flutterwaveSecretKeyEnc
      ? decryptSecret(flutterwaveSecretKeyEnc)
      : "",
    PAY_FLUTTERWAVE_WEBHOOK_SECRET: flutterwaveWebhookSecretEnc
      ? decryptSecret(flutterwaveWebhookSecretEnc)
      : "",
  };
}

export async function savePayProviderSettings(
  input: {
    provider: PayProvider;
    secretKey?: string;
    webhookSecret?: string;
    clearSecretKey?: boolean;
    clearWebhookSecret?: boolean;
  },
  adminId: number,
) {
  const secretKeyEnc = input.secretKey ? encryptSecret(input.secretKey) : null;
  const webhookSecretEnc = input.webhookSecret ? encryptSecret(input.webhookSecret) : null;
  const value = JSON.stringify({ provider: input.provider });

  await getPool().query(
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
      adminId,
      input.clearWebhookSecret === true,
    ],
  );
}
