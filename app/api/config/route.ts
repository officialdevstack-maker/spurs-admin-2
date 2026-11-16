import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getPayProviderConfig } from "@/lib/pay-provider-settings";

function matchesBootstrapSecret(expected: string, supplied: string | null) {
  if (!supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function GET(request: Request) {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { message: "Admin config service is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!matchesBootstrapSecret(secret, request.headers.get("x-admin-bootstrap"))) {
    return NextResponse.json(
      { message: "Forbidden." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const app = new URL(request.url).searchParams.get("app");
  if (app !== "pay") {
    return NextResponse.json(
      { message: "Unknown app config." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return NextResponse.json(
      { app: "pay", config: await getPayProviderConfig() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load Pay service configuration:", error);
    return NextResponse.json(
      { message: "Pay service configuration is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
