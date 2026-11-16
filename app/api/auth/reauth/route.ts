import { NextResponse } from "next/server";

import { beginAccountsSignIn } from "@/lib/accounts-oidc";
import { getAdmin } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }

    const returnTo = new URL(request.url).searchParams.get("returnTo");
    const url = await beginAccountsSignIn({ admin, returnTo });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Could not start step-up re-authentication:", error);
    return NextResponse.json(
      { message: "Re-authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
