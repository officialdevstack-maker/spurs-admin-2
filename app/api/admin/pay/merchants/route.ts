import { merchantWrite } from "@/lib/pay-merchant-write";

export const POST = (request: Request) =>
  merchantWrite(request, { permission: "pay.write", path: "/api/internal/admin/merchants", action: "create" });
