import "server-only";

function getBaseUrl() {
  const value = process.env.ACCOUNTS_API_URL;
  if (!value) throw new Error("ACCOUNTS_API_URL is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ACCOUNTS_API_URL must use HTTP or HTTPS");
  }
  return new URL(url.origin);
}

export async function accountsFetch(
  path: string,
  init: RequestInit = {},
  adminEmail?: string,
) {
  const secret = process.env.ACCOUNTS_INTERNAL_SECRET;
  if (!secret) throw new Error("ACCOUNTS_INTERNAL_SECRET is not configured");

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("x-internal-secret", secret);
  if (adminEmail) headers.set("x-admin-email", adminEmail);

  const target = new URL(path, getBaseUrl());
  const response = await fetch(target, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (process.env.NODE_ENV !== "production" && !response.ok) {
    const detail = (await response.clone().text().catch(() => "")).slice(0, 300);
    console.error(
      `[accounts] ${init.method ?? "GET"} ${target.toString()} -> ${response.status} ${detail}`,
    );
  }

  return response;
}
