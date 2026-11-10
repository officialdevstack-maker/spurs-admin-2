import { NextResponse } from "next/server";

import { getAdmin, type SessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/permissions";

export async function requireSuperAdmin(
  request: Request,
): Promise<{ admin: SessionUser } | { error: NextResponse }> {
  const admin = await getAdmin();
  if (!admin) {
    return { error: NextResponse.json({ message: "Not signed in." }, { status: 401 }) };
  }
  if (!isSuperAdmin(admin.dashboards)) {
    return { error: NextResponse.json({ message: "Forbidden." }, { status: 403 }) };
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin) {
      return { error: NextResponse.json({ message: "Invalid request origin." }, { status: 403 }) };
    }
  }
  return { admin };
}
