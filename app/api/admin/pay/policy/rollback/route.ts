import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { getPolicyVersion, savePayPolicy } from "@/lib/pay-policy";

export async function POST(request: Request) {
  const guard = await requirePermission(request, "pay.policy.manage");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/pay/policy");
  if (stepUp) return stepUp;
  const body = await request.json().catch(() => null) as
    | { version?: unknown; reason?: unknown }
    | null;
  const version = typeof body?.version === "number" ? body.version : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!version || !Number.isInteger(version) || reason.length < 3) {
    return NextResponse.json({ message: "A valid version and reason are required." }, { status: 400 });
  }
  try {
    const policy = await getPolicyVersion(version);
    if (!policy) return NextResponse.json({ message: "Policy version not found." }, { status: 404 });
    const next = await savePayPolicy(policy, { admin: guard.admin, request, reason }, version);
    return NextResponse.json({ data: { version: next, config: policy } });
  } catch (error) {
    console.error("Could not roll back Pay policy:", error);
    return NextResponse.json({ message: "Could not roll back Pay policy." }, { status: 500 });
  }
}
