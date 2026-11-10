import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getPool } from "@/lib/db";

export type EmailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

type StoredEmail = Partial<EmailConfig> & { passwordEnc?: string };

const EMAIL_DEFAULTS: EmailConfig = {
  enabled: false,
  host: "",
  port: 587,
  secure: false,
  username: "",
  fromName: "",
  fromEmail: "",
  replyTo: "",
};

async function readStored(): Promise<StoredEmail> {
  const { rows } = await getPool().query<{ value: StoredEmail }>(
    "select value from settings where key = 'email'",
  );
  return rows[0]?.value ?? {};
}

export async function getEmailConfig(): Promise<EmailConfig & { passwordSet: boolean }> {
  const { passwordEnc, ...config } = await readStored();
  return { ...EMAIL_DEFAULTS, ...config, passwordSet: Boolean(passwordEnc) };
}

export async function getEmailCredentials(): Promise<EmailConfig & { password: string }> {
  const { passwordEnc, ...config } = await readStored();
  return {
    ...EMAIL_DEFAULTS,
    ...config,
    password: passwordEnc ? decryptSecret(passwordEnc) : "",
  };
}

export async function saveEmailConfig(
  input: EmailConfig & { password?: string; clearPassword?: boolean },
  adminId: number,
) {
  const { password, clearPassword = false, ...config } = input;
  const passwordEnc = password ? encryptSecret(password) : null;
  const value = JSON.stringify(config);

  await getPool().query(
    `insert into settings (key, value, updated_by, updated_at)
     values (
       'email',
       $1::jsonb || CASE WHEN $2::text IS NULL THEN '{}'::jsonb
                         ELSE jsonb_build_object('passwordEnc', $2::text) END,
       $4,
       now()
     )
     on conflict (key) do update
       set value = $1::jsonb ||
           CASE
             WHEN $3::boolean THEN '{}'::jsonb
             WHEN $2::text IS NOT NULL THEN jsonb_build_object('passwordEnc', $2::text)
             WHEN settings.value ? 'passwordEnc'
               THEN jsonb_build_object('passwordEnc', settings.value->'passwordEnc')
             ELSE '{}'::jsonb
           END,
           updated_by = $4,
           updated_at = now()`,
    [value, passwordEnc, clearPassword, adminId],
  );
}
