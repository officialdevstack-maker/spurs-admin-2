import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { auditAccountsOidcClient } from "@/lib/accounts-oidc-audit";
import { accountsFetch } from "@/lib/accounts-server";

type RouteContext = { params: Promise<{ clientId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReason(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function callAccounts(
  clientId: string,
  method: "GET" | "PATCH" | "DELETE",
  adminEmail: string,
  body?: unknown,
  reason?: string,
) {
  const response = await accountsFetch(
    `/api/internal/admin/oidc-clients/${encodeURIComponent(clientId)}`,
    {
      method,
      ...(method !== "GET" && {
        headers: {
          ...(body !== undefined && { "Content-Type": "application/json" }),
          "x-admin-audit-reason": reason ?? "",
          "x-admin-request-id": randomUUID(),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      }),
    },
    adminEmail,
  );
  const responseBody: unknown = await response.json().catch(() => null);
  const status = response.status === 401 || response.status === 403 ? 502 : response.status;
  return { response, responseBody, status };
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "accounts.oidc_clients.manage");
  if ("error" in guard) return guard.error;
  const { clientId } = await context.params;
  try {
    const { responseBody, status } = await callAccounts(clientId, "GET", guard.admin.email);
    return NextResponse.json(responseBody, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load Accounts OIDC client:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "accounts.oidc_clients.manage");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/accounts/oidc-clients");
  if (stepUp) return stepUp;
  const values: unknown = await request.json().catch(() => null);
  if (!isRecord(values)) return NextResponse.json({ message: "Invalid request body." }, { status: 422 });

  const reason = parseReason(values.reason);
  if (reason.length < 3 || reason.length > 1000) {
    return NextResponse.json({ message: "Enter a reason for this change." }, { status: 422 });
  }
  const allowed = ["name", "redirectUris", "postLogoutRedirectUris", "backchannelLogoutUri", "scopes", "firstParty", "isActive"] as const;
  const changes = Object.fromEntries(allowed.filter((key) => key in values).map((key) => [key, values[key]]));
  if (!Object.keys(changes).length) {
    return NextResponse.json({ message: "At least one client setting is required." }, { status: 422 });
  }
  if (
    (changes.name !== undefined && (typeof changes.name !== "string" || !changes.name.trim() || changes.name.trim().length > 120)) ||
    (changes.backchannelLogoutUri !== undefined && changes.backchannelLogoutUri !== null && typeof changes.backchannelLogoutUri !== "string") ||
    (changes.firstParty !== undefined && typeof changes.firstParty !== "boolean") ||
    (changes.isActive !== undefined && typeof changes.isActive !== "boolean")
  ) {
    return NextResponse.json({ message: "Client settings are invalid." }, { status: 422 });
  }
  for (const key of ["redirectUris", "postLogoutRedirectUris", "scopes"] as const) {
    const value = changes[key];
    if (value !== undefined && (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))) {
      return NextResponse.json({ message: `${key} must be an array of strings.` }, { status: 422 });
    }
  }

  const { clientId } = await context.params;
  try {
    const { response, responseBody, status } = await callAccounts(
      clientId,
      "PATCH",
      guard.admin.email,
      changes,
      reason,
    );
    if (!response.ok) {
      const message = isRecord(responseBody) && typeof responseBody.message === "string"
        ? responseBody.message
        : "OIDC client could not be updated.";
      return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
    }
    const data = isRecord(responseBody) && isRecord(responseBody.data) ? responseBody.data : null;
    const before = data && isRecord(data.before) ? data.before : null;
    const client = data && isRecord(data.client) ? data.client : null;
    if (!client || typeof client.clientId !== "string") {
      console.error("Accounts returned an invalid OIDC client update response.");
      return NextResponse.json({ message: "Accounts returned an invalid client response." }, { status: 502 });
    }
    try {
      await auditAccountsOidcClient({
        admin: guard.admin,
        request,
        action: "updated",
        clientId,
        reason,
        before,
        after: client,
      });
    } catch (error) {
      console.error("Could not write admin audit for OIDC client update:", error);
    }
    return NextResponse.json({ data: client }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not update Accounts OIDC client:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "accounts.oidc_clients.manage");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/accounts/oidc-clients");
  if (stepUp) return stepUp;
  const values: unknown = await request.json().catch(() => null);
  const reason = isRecord(values) ? parseReason(values.reason) : "";
  if (reason.length < 3 || reason.length > 1000) {
    return NextResponse.json({ message: "Enter a reason for deactivating this client." }, { status: 422 });
  }

  const { clientId } = await context.params;
  try {
    const { response, responseBody, status } = await callAccounts(
      clientId,
      "DELETE",
      guard.admin.email,
      {},
      reason,
    );
    if (!response.ok) {
      const message = isRecord(responseBody) && typeof responseBody.message === "string"
        ? responseBody.message
        : "OIDC client could not be deactivated.";
      return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
    }
    const data = isRecord(responseBody) && isRecord(responseBody.data) ? responseBody.data : null;
    const before = data && isRecord(data.before) ? data.before : null;
    const client = data && isRecord(data.client) ? data.client : null;
    if (!client || typeof client.clientId !== "string") {
      console.error("Accounts returned an invalid OIDC client deactivation response.");
      return NextResponse.json({ message: "Accounts returned an invalid client response." }, { status: 502 });
    }
    try {
      await auditAccountsOidcClient({
        admin: guard.admin,
        request,
        action: "deactivated",
        clientId,
        reason,
        before,
        after: client,
      });
    } catch (error) {
      console.error("Could not write admin audit for OIDC client deactivation:", error);
    }
    return NextResponse.json({ data: client }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not deactivate Accounts OIDC client:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}
