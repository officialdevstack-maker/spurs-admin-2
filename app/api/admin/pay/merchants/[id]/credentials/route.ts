import { NextResponse } from "next/server";

import { accountsFetch } from "@/lib/accounts-server";
import { requirePermission } from "@/lib/admin-guard";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const guard = await requirePermission(request, "pay.view");
  if ("error" in guard) return guard.error;

  try {
    const response = await accountsFetch(
      `/api/internal/admin/pay-merchants/${id}/oauth-client`,
      {},
      guard.admin.email,
    );
    if (response.status === 404) {
      return NextResponse.json({ clientId: null, isActive: false, lastUsedAt: null }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const rejected = response.status === 401 || response.status === 403;
    return new NextResponse(
      rejected
        ? JSON.stringify({ message: "Accounts service credentials rejected." })
        : await response.text(),
      {
        status: rejected ? 502 : response.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Could not load merchant credentials:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}
