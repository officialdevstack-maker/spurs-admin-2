import { NextResponse } from "next/server";

import { getAdmin, type SessionUser } from "@/lib/session";
import { hasPermission, type PermissionName } from "@/lib/permissions";
import { expectedOrigin } from "@/lib/origin";

export async function requireAnyPermission(
  request: Request,
  permissions: readonly PermissionName[],
): Promise<{ admin: SessionUser } | { error: NextResponse }> {
  const admin = await getAdmin();
  if (!admin) {
    return { error: NextResponse.json({ message: "Not signed in." }, { status: 401 }) };
  }
  if (!permissions.some((permission) => hasPermission(admin.permissions, permission))) {
    return { error: NextResponse.json({ message: "Forbidden." }, { status: 403 }) };
  }
  if (request.method !== "GET") {
    if (request.headers.get("origin") !== expectedOrigin(request)) {
      return { error: NextResponse.json({ message: "Invalid request origin." }, { status: 403 }) };
    }
  }
  return { admin };
}

export function requirePermission(request: Request, permission: PermissionName) {
  return requireAnyPermission(request, [permission]);
}
