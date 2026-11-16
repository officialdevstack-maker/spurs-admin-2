import "server-only";

import { createHash } from "node:crypto";
import { SpursAuth } from "@spurs/auth";

import { getPool } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const REQUEST_TTL_MS = 10 * 60 * 1000;
const STEP_UP_MAX_AGE_SECONDS = 300;

export type PendingOidcRequest = {
  nonce: string;
  code_verifier: string;
  redirect_uri: string;
  return_to: string;
  admin_user_id: number | null;
  accounts_sub: string | null;
  step_up: boolean;
};

function authClient() {
  const issuer = process.env.ACCOUNTS_ISSUER?.trim();
  const clientId = process.env.ACCOUNTS_CLIENT_ID?.trim();
  const clientSecret = process.env.ACCOUNTS_CLIENT_SECRET?.trim();
  const appOrigin = process.env.APP_ORIGIN?.trim();

  if (!issuer || !clientId || !clientSecret || !appOrigin) {
    throw new Error("Accounts OIDC and APP_ORIGIN must be configured.");
  }

  return new SpursAuth({
    issuer,
    clientId,
    clientSecret,
    redirectUri: new URL("/api/auth/callback", appOrigin).toString(),
    postLogoutRedirectUri: appOrigin,
    scope: "openid profile email",
    storage: "memory",
  });
}

export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function beginAccountsSignIn(options: {
  returnTo?: string | null;
  admin?: SessionUser;
} = {}) {
  const stepUp = Boolean(options.admin);
  const client = authClient();
  const request = await client.createAuthorizationRequest(
    stepUp
      ? { prompt: "login", maxAge: STEP_UP_MAX_AGE_SECONDS }
      : {},
  );
  const stateHash = createHash("sha256").update(request.state).digest("hex");
  const returnTo = safeReturnTo(options.returnTo);

  await getPool().query("delete from admin_oidc_auth_requests where expires_at <= now()");
  await getPool().query(
    `insert into admin_oidc_auth_requests
       (state_hash, nonce, code_verifier, redirect_uri, return_to,
        admin_user_id, accounts_sub, step_up, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      stateHash,
      request.nonce,
      request.codeVerifier,
      request.redirectUri,
      returnTo,
      options.admin?.id ?? null,
      options.admin?.accountsSub ?? null,
      stepUp,
      new Date(Date.now() + REQUEST_TTL_MS),
    ],
  );

  return request.url;
}

export async function consumeAccountsSignIn(callbackUrl: string, pending: PendingOidcRequest) {
  const client = authClient();
  return client.exchangeCode(callbackUrl, {
    state: new URL(callbackUrl).searchParams.get("state") ?? "",
    nonce: pending.nonce,
    codeVerifier: pending.code_verifier,
    redirectUri: pending.redirect_uri,
  });
}

export const MAX_STEP_UP_AGE_SECONDS = STEP_UP_MAX_AGE_SECONDS;
