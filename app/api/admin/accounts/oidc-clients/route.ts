import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { auditAccountsOidcClient } from "@/lib/accounts-oidc-audit";
import { accountsFetch } from "@/lib/accounts-server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return value.map((entry) => entry.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "accounts.oidc_clients.manage");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/accounts/oidc-clients");
  if (stepUp) return stepUp;

  const values: unknown = await request.json().catch(() => null);
  if (!isRecord(values)) {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }
  const name = typeof values.name === "string" ? values.name.trim() : "";
  const reason = typeof values.reason === "string" ? values.reason.trim() : "";
  const redirectUris = stringArray(values.redirectUris);
  const postLogoutRedirectUris = stringArray(values.postLogoutRedirectUris);
  const scopes = values.scopes === undefined ? undefined : stringArray(values.scopes);
  const flags = ["firstParty", "public", "clientCredentials", "service"] as const;
  if (!name || name.length > 120 || reason.length < 3 || reason.length > 1000) {
    return NextResponse.json(
      { message: "Enter an app name (up to 120 characters) and a reason (at least 3 characters)." },
      { status: 422 },
    );
  }
  if (!redirectUris || !postLogoutRedirectUris || scopes === null) {
    return NextResponse.json({ message: "URI and scope values must be arrays of strings." }, { status: 422 });
  }
  if (flags.some((key) => values[key] !== undefined && typeof values[key] !== "boolean")) {
    return NextResponse.json({ message: "Client options must be boolean values." }, { status: 422 });
  }
  if (
    values.backchannelLogoutUri !== undefined &&
    values.backchannelLogoutUri !== null &&
    typeof values.backchannelLogoutUri !== "string"
  ) {
    return NextResponse.json({ message: "Back-channel logout URI must be a string." }, { status: 422 });
  }

  const requestId = randomUUID();
  const body = {
    name,
    redirectUris,
    postLogoutRedirectUris,
    backchannelLogoutUri: values.backchannelLogoutUri,
    scopes,
    firstParty: values.firstParty === true,
    public: values.public === true,
    clientCredentials: values.clientCredentials === true,
    service: values.service === true,
  };

  let response: Response;
  try {
    response = await accountsFetch(
      "/api/internal/admin/oidc-clients",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-audit-reason": reason,
          "x-admin-request-id": requestId,
        },
        body: JSON.stringify(body),
      },
      guard.admin.email,
    );
  } catch (error) {
    console.error("Accounts OIDC client registration failed:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }

  const accountBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(accountBody) && typeof accountBody.message === "string"
      ? accountBody.message
      : "OIDC client could not be registered.";
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }

  const data = isRecord(accountBody) && isRecord(accountBody.data) ? accountBody.data : null;
  if (
    !data ||
    typeof data.clientId !== "string" ||
    !(typeof data.clientSecret === "string" || data.clientSecret === null)
  ) {
    console.error("Accounts returned an invalid OIDC client registration response.");
    return NextResponse.json({ message: "Accounts returned an invalid client response." }, { status: 502 });
  }

  try {
    await auditAccountsOidcClient({
      admin: guard.admin,
      request,
      action: "created",
      clientId: data.clientId,
      reason,
      before: null,
      after: {
        clientId: data.clientId,
        name,
        scopes,
        clientCredentials: body.clientCredentials || body.service,
        public: body.public,
      },
    });
  } catch (error) {
    console.error("Could not write admin audit for OIDC client registration:", error);
  }

  return NextResponse.json({ data }, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "accounts.oidc_clients.manage");
  if ("error" in guard) return guard.error;
  try {
    const response = await accountsFetch("/api/internal/admin/oidc-clients", {}, guard.admin.email);
    const body = await response.text();
    const status = response.status === 401 || response.status === 403 ? 502 : response.status;
    return new NextResponse(body, {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not list Accounts OIDC clients:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}
