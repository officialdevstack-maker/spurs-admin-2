export type AdminUser = {
  email: string;
  name: string;
  role: string | null;
  dashboards: string[];
  permissions: string[];
};

type AuthResponse = { user?: AdminUser; message?: string };

async function request<T extends AuthResponse>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new Error(body.message ?? "Authentication request failed");
  }
  return body;
}

export async function getSessionUser(): Promise<AdminUser | null> {
  const response = await fetch("/api/auth/me", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  const body = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) {
    throw new Error(body.message ?? "Could not verify panel session");
  }
  return body.user ?? null;
}

export async function loginRequest(email: string, password: string): Promise<AdminUser> {
  const { user } = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!user) throw new Error("Invalid authentication response");
  return user;
}

export async function logoutRequest(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function changePasswordRequest(current: string, next: string): Promise<void> {
  await request("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current, next }),
  });
}
