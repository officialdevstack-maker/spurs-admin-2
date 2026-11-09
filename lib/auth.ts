export type AdminUser = { email: string; name: string };

type AuthResponse = { data?: AdminUser; message?: string };

async function request<T extends AuthResponse>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new Error(json.message ?? "Authentication request failed");
  }
  return json;
}

export async function getStoredUser(): Promise<AdminUser | null> {
  const response = await fetch("/api/auth/session", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  const json = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) {
    throw new Error(json.message ?? "Could not verify panel session");
  }
  return json.data ?? null;
}

export async function loginRequest(email: string, password: string): Promise<AdminUser> {
  const response = await request<{ data?: AdminUser }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.data) throw new Error("Invalid authentication response");
  return response.data;
}

export async function logoutRequest(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}
