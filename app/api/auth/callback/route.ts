import { NextResponse } from "next/server";

import {
  consumeAccountsSignIn,
  MAX_STEP_UP_AGE_SECONDS,
  type PendingOidcRequest,
} from "@/lib/accounts-oidc";
import { getPool } from "@/lib/db";
import { createSession } from "@/lib/session";

function signInFailure() {
  return NextResponse.redirect(new URL("/login?error=signin", process.env.APP_ORIGIN));
}

async function findOrLinkAdmin(sub: string, email: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      id: number;
      email: string;
      accounts_sub: string | null;
      is_admin: boolean;
      suspended_at: Date | null;
      admin_suspended_at: Date | null;
    }>(
      `select id, email, accounts_sub, is_admin, suspended_at, admin_suspended_at
       from users
       where accounts_sub = $1 or lower(email) = lower($2)
       for update`,
      [sub, email],
    );
    const bySubject = rows.find((row) => row.accounts_sub === sub);
    const byEmail = rows.find((row) => row.email.toLowerCase() === email.toLowerCase());
    if (bySubject && byEmail && bySubject.id !== byEmail.id) {
      throw new Error("Accounts identity conflicts with the configured admin email.");
    }

    const admin = bySubject ?? (byEmail?.accounts_sub === null ? byEmail : undefined);
    if (
      !admin ||
      !admin.is_admin ||
      admin.suspended_at ||
      admin.admin_suspended_at ||
      (admin.accounts_sub !== null && admin.accounts_sub !== sub)
    ) {
      await client.query("ROLLBACK");
      return null;
    }

    if (admin.accounts_sub === null) {
      await client.query(
        "update users set accounts_sub = $1, updated_at = now() where id = $2",
        [sub, admin.id],
      );
    }
    await client.query("COMMIT");
    return { id: Number(admin.id), accountsSub: sub };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Could not roll back Accounts identity linking:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request: Request) {
  const callbackUrl = new URL(request.url);
  const state = callbackUrl.searchParams.get("state");
  if (!state || state.length > 200) return signInFailure();

  try {
    const stateHash = (await import("node:crypto")).createHash("sha256").update(state).digest("hex");
    const { rows } = await getPool().query<PendingOidcRequest>(
      `delete from admin_oidc_auth_requests
       where state_hash = $1 and expires_at > now()
       returning nonce, code_verifier, redirect_uri, return_to,
                 admin_user_id, accounts_sub, step_up`,
      [stateHash],
    );
    const pending = rows[0];
    if (!pending) return signInFailure();

    const tokens = await consumeAccountsSignIn(callbackUrl.toString(), pending);
    const claims = tokens.claims;
    if (
      !claims ||
      !claims.sub ||
      claims.email_verified !== true ||
      typeof claims.email !== "string" ||
      typeof claims.auth_time !== "number" ||
      !Number.isSafeInteger(claims.auth_time)
    ) {
      throw new Error("Accounts did not return a verified admin identity.");
    }

    const ageSeconds = Date.now() / 1000 - claims.auth_time;
    if (ageSeconds < -30 || (pending.step_up && ageSeconds > MAX_STEP_UP_AGE_SECONDS + 30)) {
      throw new Error("Accounts authentication is not recent enough.");
    }

    const admin = await findOrLinkAdmin(claims.sub, claims.email);
    if (!admin) return signInFailure();
    if (
      pending.step_up &&
      (pending.admin_user_id !== admin.id || pending.accounts_sub !== claims.sub)
    ) {
      throw new Error("Step-up identity does not match the signed-in admin.");
    }

    await createSession(admin.id, admin.accountsSub, claims.auth_time);
    return NextResponse.redirect(new URL(pending.return_to, process.env.APP_ORIGIN));
  } catch (error) {
    console.error("Accounts sign-in callback failed:", error);
    return signInFailure();
  }
}
