import { NextResponse } from "next/server";

import { payMerchantAdminWrite } from "@/lib/pay-merchant-admin-write";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function write(
  request: Request,
  context: { params: Promise<{ id: string }> },
  method: "POST" | "PUT",
) {
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return payMerchantAdminWrite(request, {
    merchantId: id,
    path: `/api/internal/admin/merchants/${id}/webhooks`,
    method,
    action: method === "POST" ? "pay.merchant.webhook.create" : "pay.merchant.webhook.update",
  });
}

export const POST = (request: Request, context: { params: Promise<{ id: string }> }) =>
  write(request, context, "POST");
export const PUT = (request: Request, context: { params: Promise<{ id: string }> }) =>
  write(request, context, "PUT");
