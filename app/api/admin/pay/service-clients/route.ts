import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import {
  addServiceClient,
  listServiceClients,
  validateServiceClient,
  type ServiceProduct,
} from "@/lib/pay-service-clients";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "pay.service_clients.manage");
  if ("error" in guard) return guard.error;
  try {
    return NextResponse.json({ data: await listServiceClients() });
  } catch (error) {
    console.error("Could not load Pay service clients:", error);
    return NextResponse.json({ message: "Service clients are unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "pay.service_clients.manage");
  if ("error" in guard) return guard.error;
  const stepUp = requireRecentAuth(guard.admin, "/pay/service-clients");
  if (stepUp) return stepUp;
  const body = await request.json().catch(() => null) as
    | { clientId?: unknown; product?: unknown; reason?: unknown }
    | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const product = typeof body?.product === "string" ? body.product : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const validation = validateServiceClient(clientId, product);
  if (validation) return NextResponse.json({ message: validation }, { status: 400 });
  if (reason.length < 3) return NextResponse.json({ message: "A reason is required." }, { status: 400 });
  try {
    await addServiceClient(clientId, product as ServiceProduct, { admin: guard.admin, request, reason });
    return NextResponse.json({ data: await listServiceClients() });
  } catch (error) {
    console.error("Could not grant Pay service access:", error);
    return NextResponse.json({ message: "Could not grant service access." }, { status: 500 });
  }
}
