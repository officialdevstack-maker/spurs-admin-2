import { NextResponse } from "next/server";

import { payMerchantAdminWrite } from "@/lib/pay-merchant-admin-write";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; deliveryId: string }> },
) {
  const { id, deliveryId } = await context.params;
  if (!uuid.test(id) || !uuid.test(deliveryId)) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return payMerchantAdminWrite(request, {
    merchantId: id,
    path: `/api/internal/admin/merchants/${id}/webhooks/deliveries/${deliveryId}/redeliver`,
    method: "POST",
    action: "pay.merchant.webhook.redeliver",
  });
}
