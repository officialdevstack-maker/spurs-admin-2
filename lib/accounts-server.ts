import "server-only";

function getConfig() {
  const value = process.env.ACCOUNTS_API_URL;
  const secret = process.env.INTERNAL_SHARED_SECRET;
  if (!value) throw new Error("ACCOUNTS_API_URL is not configured");
  if (!secret) throw new Error("INTERNAL_SHARED_SECRET is not configured");

  const base = new URL(value);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("ACCOUNTS_API_URL must use HTTP or HTTPS");
  }
  return { base, secret };
}

/**
 * Calls the accounts backend's internal admin API.
 * `path` is relative to /api/internal, e.g. "/stats/users?days=30".
 */
export async function accountsFetch(
  path: string,
  init: RequestInit & { adminEmail?: string } = {},
) {
  const { base, secret } = getConfig();
  const { adminEmail, ...rest } = init;

  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");
  headers.set("x-internal-secret", secret);
  if (adminEmail) headers.set("x-admin-email", adminEmail);

  return fetch(new URL(`/api/internal${path}`, base), {
    ...rest,
    headers,
    cache: "no-store",
  });
}
