import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { getActivePolicy, savePayPolicy } from "@/lib/pay-policy";
import { parsePolicy } from "@/lib/pay-policy-schema";

export async function GET(request: Request) {
  try {
    const guard = await requirePermission(request, "pay.policy.manage");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getActivePolicy() });
  } catch (error) {
    console.error("Could not load Pay policy:", error);
    return NextResponse.json({ message: "Policy is unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requirePermission(request, "pay.policy.manage");
    if ("error" in guard) return guard.error;
    const stepUp = requireRecentAuth(guard.admin, "/pay/policy");
    if (stepUp) return stepUp;
    const body = await request.json().catch(() => null) as
      | { config?: unknown; reason?: unknown }
      | null;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3) {
      return NextResponse.json({ message: "A reason is required." }, { status: 400 });
    }
    const policy = parsePolicy(body?.config);
    if (typeof policy === "string") {
      return NextResponse.json({ message: policy }, { status: 400 });
    }
    const version = await savePayPolicy(policy, { admin: guard.admin, request, reason });
    return NextResponse.json({ data: { version, config: policy } });
  } catch (error) {
    console.error("Could not update Pay policy:", error);
    return NextResponse.json({ message: "Could not update Pay policy." }, { status: 500 });
  }
}
