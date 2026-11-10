export type AdminRole = {
  id: number;
  name: string;
  description: string;
  dashboards: string[];
  permissions: string[];
};

export type AdminRow = {
  id: number;
  fullname: string;
  email: string;
  suspendedAt: string | null;
  roleId: number | null;
  roleName: string | null;
};

export type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  passwordSet: boolean;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(json.message ?? "Request failed");
  return json;
}

export const listAdmins = () =>
  call<{ data: AdminRow[]; currentId: number }>("/api/admin/users");
export const listRoles = () => call<{ data: AdminRole[] }>("/api/admin/roles");
export const createRole = (input: {
  name: string;
  description: string;
  dashboards: string[];
  permissions?: string[];
}) => call("/api/admin/roles", { method: "POST", body: JSON.stringify(input) });
export const updateRole = (
  id: number,
  changes: { name?: string; description?: string; dashboards?: string[]; permissions?: string[] },
) => call(`/api/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
export const createAdmin = (input: {
  fullname: string;
  email: string;
  password: string;
  roleId: number;
}) => call("/api/admin/users", { method: "POST", body: JSON.stringify(input) });
export const updateAdmin = (id: number, changes: { roleId?: number; suspended?: boolean }) =>
  call(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
export const getEmailSettings = () =>
  call<{ data: EmailSettings }>("/api/admin/settings/email").then((response) => response.data);
export const updateEmailSettings = (
  input: Omit<EmailSettings, "passwordSet"> & { password?: string; clearPassword?: boolean },
) =>
  call<{ data: EmailSettings }>("/api/admin/settings/email", {
    method: "PUT",
    body: JSON.stringify(input),
  }).then((response) => response.data);
