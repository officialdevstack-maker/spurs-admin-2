import { NextResponse } from "next/server";

import { merchantWrite } from "@/lib/pay-merchant-write";
import type { PermissionName } from "@/lib/permissions";

const ACTIONS = {
  approve: "pay.approve",
  suspend: "pay.write",
  reactivate: "pay.approve",
} as const satisfies Record<string, PermissionName>;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await context.params;
  if (
    !Object.prototype.hasOwnProperty.call(ACTIONS, action) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  const key = action as keyof typeof ACTIONS;
  return merchantWrite(request, {
    permission: ACTIONS[key],
    path: `/api/internal/admin/merchants/${id}/${key}`,
    action: key,
  });
}
