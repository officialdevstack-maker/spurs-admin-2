export type AdminUser = { email: string; name: string };

const CREDS_KEY = "admin_credentials";
const SESSION_KEY = "admin_session";

export const DEFAULT_CREDENTIALS = {
  email: "admin@example.com",
  password: "admin123",
};

type Credentials = { email: string; password: string };

function readCreds(): Credentials {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (raw) return JSON.parse(raw) as Credentials;
  } catch {}
  return DEFAULT_CREDENTIALS;
}

export function getStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export async function loginRequest(email: string, password: string): Promise<AdminUser> {
  await new Promise((r) => setTimeout(r, 400));
  const creds = readCreds();
  if (email.trim().toLowerCase() !== creds.email || password !== creds.password) {
    throw new Error("Invalid email or password");
  }
  const user: AdminUser = { email: creds.email, name: "Admin" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function logoutRequest() {
  localStorage.removeItem(SESSION_KEY);
}

export async function changePasswordRequest(current: string, next: string) {
  await new Promise((r) => setTimeout(r, 400));
  const creds = readCreds();
  if (current !== creds.password) throw new Error("Current password is incorrect");
  localStorage.setItem(CREDS_KEY, JSON.stringify({ ...creds, password: next }));
}
