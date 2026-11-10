export const ALL_ACCESS = "*";
export const ALL_PERMISSIONS = "*";

export const PERMISSION_CATALOG = {
  "accounts.view": "View account lists and details",
  "accounts.create": "Create new accounts",
  "accounts.suspend": "Suspend and restore accounts",
  "accounts.verify": "Verify account email addresses",
  "accounts.revoke_sessions": "Revoke active account sessions",
  "accounts.settings": "Update account settings",
  "admins.manage": "Manage admin users",
  "roles.manage": "Manage admin roles",
} as const;

export type PermissionName = keyof typeof PERMISSION_CATALOG;

export function normalizePermissions(values?: Array<string | null | undefined> | null) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed === ALL_PERMISSIONS || trimmed in PERMISSION_CATALOG) {
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        cleaned.push(trimmed);
      }
    }
  }

  return cleaned;
}

export function isPermissionAllowed(value: string) {
  return value === ALL_PERMISSIONS || value in PERMISSION_CATALOG;
}

export function isSuperAdmin(permissions: string[] = []) {
  return normalizePermissions(permissions).includes(ALL_PERMISSIONS);
}

export function hasPermission(permissions: string[] = [], permission: string) {
  const normalized = normalizePermissions(permissions);
  return isSuperAdmin(normalized) || normalized.includes(permission);
}

export function canAccessDashboard(dashboards: string[] = [], slug: string) {
  return dashboards.includes(ALL_ACCESS) || dashboards.includes(slug);
}
