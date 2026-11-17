import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { insertAdminAudit } from "@/lib/admin-audit";
import { accountsFetch } from "@/lib/accounts-server";
import { getPool } from "@/lib/db";
import { payFetch } from "@/lib/pay-server";
import type { PermissionName } from "@/lib/permissions";

type PayMerchantBody = {
  merchant?: { id: string; status: string };
  previousStatus?: string;
  error?: { code?: string; message?: string };
};

type IssuedCredentials = { clientId: string; clientSecret: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function revokeProvisionedClient(merchantId: string, adminEmail: string, reason: string) {
  try {
    const response = await accountsFetch(
      `/api/internal/admin/pay-merchants/${merchantId}/oauth-client/revoke`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-audit-reason": reason,
          "x-admin-request-id": randomUUID(),
        },
        body: JSON.stringify({}),
      },
      adminEmail,
    );
    return response.ok;
  } catch (error) {
    console.error("Could not revoke OAuth client after failed Pay merchant creation:", error);
    return false;
  }
}

export async function merchantWrite(
  request: Request,
  spec: { permission: PermissionName; path: string; action: "create" | "approve" | "suspend" | "reactivate" },
) {
  const guard = await requirePermission(request, spec.permission);
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/pay/merchants");
  if (stepUp) return stepUp;

  const values: unknown = await request.json().catch(() => null);
  if (!isRecord(values)) {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }
  const reason = typeof values.reason === "string" ? values.reason.trim() : "";
  if (!reason || reason.length > 1000) {
    return NextResponse.json({ message: "Enter a reason for this change." }, { status: 422 });
  }
  const payload = { ...values };
  delete payload.reason;
  const requestId = randomUUID();

  let credentials: IssuedCredentials | null = null;
  let merchantId: string | null = null;
  if (spec.action === "create") {
    if (
      typeof payload.name !== "string" ||
      typeof payload.returnUrl !== "string"
    ) {
      return NextResponse.json({ message: "Merchant name and return URL are required." }, { status: 422 });
    }
    merchantId = randomUUID();
    let accountResponse: Response;
    try {
      accountResponse = await accountsFetch(
        `/api/internal/admin/pay-merchants/${merchantId}/oauth-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-audit-reason": reason,
            "x-admin-request-id": requestId,
          },
          body: JSON.stringify({ name: payload.name }),
        },
        guard.admin.email,
      );
    } catch (error) {
      console.error("Accounts OAuth client provisioning failed:", error);
      return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
    }
    const accountBody: unknown = await accountResponse.json().catch(() => null);
    const issued = isRecord(accountBody) && isRecord(accountBody.data) ? accountBody.data : null;
    if (
      !accountResponse.ok ||
      !issued ||
      typeof issued.clientId !== "string" ||
      typeof issued.clientSecret !== "string"
    ) {
      return NextResponse.json(
        { message: "Merchant credentials could not be provisioned." },
        { status: accountResponse.status >= 400 && accountResponse.status < 500 ? accountResponse.status : 502 },
      );
    }
    credentials = { clientId: issued.clientId, clientSecret: issued.clientSecret };
    payload.id = merchantId;
    payload.clientId = credentials.clientId;
  }

  let response: Response;
  try {
    response = await payFetch(spec.path, guard.admin, request, {
      method: "POST",
      body: payload,
      reason,
      requestId,
    });
  } catch (error) {
    console.error("Pay merchant write failed:", error);
    if (merchantId) {
      const revoked = await revokeProvisionedClient(
        merchantId,
        guard.admin.email,
        "Compensating revoke after failed Pay merchant creation.",
      );
      if (!revoked) {
        return NextResponse.json(
          { message: "Pay merchant creation failed and the new OAuth client could not be revoked; contact an administrator." },
          { status: 502 },
        );
      }
    }
    return NextResponse.json({ message: "Pay service is unavailable." }, { status: 502 });
  }

  const body = (await response.json().catch(() => ({}))) as PayMerchantBody;
  if (!response.ok) {
    const code = body.error?.code;
    if (merchantId) {
      const revoked = await revokeProvisionedClient(
        merchantId,
        guard.admin.email,
        "Compensating revoke after rejected Pay merchant creation.",
      );
      if (!revoked) {
        return NextResponse.json(
          { message: "Pay merchant creation failed and the new OAuth client could not be revoked; contact an administrator." },
          { status: 502 },
        );
      }
    }
    if (code === "STEP_UP_REQUIRED") {
      return NextResponse.json(
        { message: "Confirm your sign-in again to perform this action.", reauthUrl: "/reauth?returnTo=%2Fpay%2Fmerchants" },
        { status: 403 },
      );
    }
    if (response.status === 401 || (response.status === 403 && code === "FORBIDDEN")) {
      return NextResponse.json({ message: "Pay service credentials rejected." }, { status: 502 });
    }
    return NextResponse.json(
      { message: body.error?.message ?? "Request failed." },
      { status: response.status },
    );
  }

  try {
    const client = await getPool().connect();
    try {
      await insertAdminAudit(client, {
        admin: guard.admin,
        request,
        action: `pay.merchant.${spec.action}`,
        resource: `pay.merchant:${body.merchant?.id ?? "unknown"}`,
        reason,
        before: body.previousStatus ? { status: body.previousStatus } : null,
        after: body.merchant ? { status: body.merchant.status } : null,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Could not write admin audit for merchant change:", error);
  }

  return NextResponse.json(
    { ...body, ...(credentials && { credentials }) },
    { status: response.status },
  );
}
