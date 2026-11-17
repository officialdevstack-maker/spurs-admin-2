import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { insertAdminAudit } from "@/lib/admin-audit";
import { getPool } from "@/lib/db";
import { payFetch } from "@/lib/pay-server";
import type { PermissionName } from "@/lib/permissions";

type PayMerchantBody = {
  merchant?: { id: string; status: string };
  previousStatus?: string;
  error?: { code?: string; message?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  let response: Response;
  try {
    response = await payFetch(spec.path, guard.admin, request, {
      method: "POST",
      body: payload,
      reason,
      requestId: randomUUID(),
    });
  } catch (error) {
    console.error("Pay merchant write failed:", error);
    return NextResponse.json({ message: "Pay service is unavailable." }, { status: 502 });
  }

  const body = (await response.json().catch(() => ({}))) as PayMerchantBody;
  if (!response.ok) {
    const code = body.error?.code;
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

  return NextResponse.json(body, { status: response.status });
}
