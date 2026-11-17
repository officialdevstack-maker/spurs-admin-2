import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { insertAdminAudit } from "@/lib/admin-audit";
import { getPool } from "@/lib/db";
import { payFetch } from "@/lib/pay-server";
import type { PermissionName } from "@/lib/permissions";

export async function payMerchantAdminWrite(
  request: Request,
  input: {
    merchantId: string;
    path: string;
    method: "POST" | "PUT";
    action: string;
    permission?: PermissionName;
  },
) {
  const guard = await requirePermission(request, input.permission ?? "pay.write");
  if ("error" in guard) return guard.error;
  const returnTo = `/pay/merchants/${input.merchantId}`;
  const stepUp = requireRecentAuth(guard.admin, returnTo);
  if (stepUp) return stepUp;

  const values: unknown = await request.json().catch(() => null);
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }
  const record = values as Record<string, unknown>;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  if (!reason || reason.length > 1000) {
    return NextResponse.json({ message: "Enter a reason for this change." }, { status: 422 });
  }
  delete record.reason;

  const requestId = randomUUID();
  let response: Response;
  try {
    response = await payFetch(input.path, guard.admin, request, {
      method: input.method,
      body: record,
      reason,
      requestId,
    });
  } catch (error) {
    console.error("Pay merchant admin write failed:", error);
    return NextResponse.json({ message: "Pay service is unavailable." }, { status: 502 });
  }

  const responseBody: unknown = await response.json().catch(() => null);
  const errorBody =
    typeof responseBody === "object" && responseBody !== null
      ? (responseBody as { error?: { code?: string; message?: string } })
      : {};
  if (!response.ok) {
    if (errorBody.error?.code === "STEP_UP_REQUIRED") {
      return NextResponse.json(
        { message: "Confirm your sign-in again to perform this action.", reauthUrl: `/reauth?returnTo=${encodeURIComponent(returnTo)}` },
        { status: 403 },
      );
    }
    if (response.status === 401 || (response.status === 403 && errorBody.error?.code === "FORBIDDEN")) {
      return NextResponse.json({ message: "Pay service credentials rejected." }, { status: 502 });
    }
    return NextResponse.json(
      { message: errorBody.error?.message ?? "Request failed." },
      { status: response.status },
    );
  }

  try {
    const client = await getPool().connect();
    try {
      await insertAdminAudit(client, {
        admin: guard.admin,
        request,
        action: input.action,
        resource: `pay.merchant:${input.merchantId}`,
        reason,
        before: null,
        after: { merchantId: input.merchantId, ...record },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Could not write admin audit for Pay merchant change:", error);
  }

  return NextResponse.json(responseBody ?? {}, { status: response.status });
}
