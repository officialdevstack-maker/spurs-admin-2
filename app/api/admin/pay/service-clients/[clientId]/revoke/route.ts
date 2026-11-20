import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { revokeServiceClient } from "@/lib/pay-service-clients";

export async function POST(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const guard = await requirePermission(request, "pay.service_clients.manage");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/pay/service-clients");
  if (stepUp) return stepUp;
  const { clientId } = await context.params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3) return NextResponse.json({ message: "A reason is required." }, { status: 400 });
  try {
    const revoked = await revokeServiceClient(decodeURIComponent(clientId), {
      admin: guard.admin,
      request,
      reason,
    });
    if (!revoked) return NextResponse.json({ message: "Service client is not active." }, { status: 404 });
    return NextResponse.json({ data: { clientId: decodeURIComponent(clientId), revoked: true } });
  } catch (error) {
    console.error("Could not revoke Pay service access:", error);
    return NextResponse.json({ message: "Could not revoke service access." }, { status: 500 });
  }
}
