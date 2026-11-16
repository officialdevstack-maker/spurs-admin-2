import "server-only";

function getBaseUrl() {
  const value = process.env.PAY_API_URL;
  if (!value) throw new Error("PAY_API_URL is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PAY_API_URL must use HTTP or HTTPS");
  }
  return new URL(url.origin);
}

export async function payFetch(path: string) {
  const secret = process.env.PAY_INTERNAL_SECRET?.trim();
  if (!secret) throw new Error("PAY_INTERNAL_SECRET is not configured");
  if (secret.length < 32) {
    throw new Error("PAY_INTERNAL_SECRET must be at least 32 characters");
  }

  const headers = new Headers({
    Accept: "application/json",
    "x-internal-secret": secret,
  });
  const target = new URL(path, getBaseUrl());
  return fetch(target, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}
