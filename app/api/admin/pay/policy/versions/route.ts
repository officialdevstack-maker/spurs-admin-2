import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/admin-guard";
import { listPolicyVersions } from "@/lib/pay-policy";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "pay.policy.manage");
  if ("error" in guard) return guard.error;
  try {
    return NextResponse.json({ data: await listPolicyVersions() });
  } catch (error) {
    console.error("Could not load Pay policy history:", error);
    return NextResponse.json({ message: "Policy history is unavailable." }, { status: 503 });
  }
}
