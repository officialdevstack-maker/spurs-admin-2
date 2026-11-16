import { NextResponse } from "next/server";

import { beginAccountsSignIn } from "@/lib/accounts-oidc";

export async function GET(request: Request) {
  try {
    const url = await beginAccountsSignIn({
      returnTo: new URL(request.url).searchParams.get("returnTo"),
    });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Could not start Accounts sign-in:", error);
    return NextResponse.json(
      { message: "Accounts sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }
}
