import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { accountsFetch } from "@/lib/accounts-server";
import { insertAdminAudit } from "@/lib/admin-audit";
import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { getPool } from "@/lib/db";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await context.params;
  if (!uuid.test(id) || (action !== "rotate" && action !== "revoke")) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  const guard = await requirePermission(request, "pay.write");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/pay/merchants");
  if (stepUp) return stepUp;

  const values: unknown = await request.json().catch(() => null);
  const reason = isRecord(values) && typeof values.reason === "string" ? values.reason.trim() : "";
  if (!reason || reason.length > 1000) {
    return NextResponse.json({ message: "Enter a reason for this change." }, { status: 422 });
  }

  const requestId = randomUUID();
  try {
    const response = await accountsFetch(
      `/api/internal/admin/pay-merchants/${id}/oauth-client/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-audit-reason": reason,
          "x-admin-request-id": requestId,
        },
        body: JSON.stringify({}),
      },
      guard.admin.email,
    );
    const rejected = response.status === 401 || response.status === 403;
    const responseBody = rejected
      ? { message: "Accounts service credentials rejected." }
      : await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        rejected ? responseBody : { message: "Credential change failed." },
        { status: rejected ? 502 : response.status },
      );
    }

    try {
      const client = await getPool().connect();
      try {
        await insertAdminAudit(client, {
          admin: guard.admin,
          request,
          action: `pay.merchant.credentials.${action}`,
          resource: `pay.merchant:${id}`,
          reason,
          before: action === "revoke" ? { isActive: true } : null,
          after: { isActive: action !== "revoke" },
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Could not write admin audit for merchant credential change:", error);
    }

    const data = isRecord(responseBody) ? responseBody.data : undefined;
    return NextResponse.json(data ?? {}, { status: response.status });
  } catch (error) {
    console.error("Merchant credential change failed:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}
