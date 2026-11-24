export const ALL_ACCESS = "*";
export const ALL_PERMISSIONS = "*";

export const PERMISSION_CATALOG = {
  "accounts.view": "View account lists and details",
  "accounts.create": "Create new accounts",
  "accounts.suspend": "Suspend and restore accounts",
  "accounts.verify": "Verify account email addresses",
  "accounts.revoke_sessions": "Revoke active account sessions",
  "accounts.settings": "Update account settings",
  "accounts.oidc_clients.manage": "Register OIDC clients for Accounts",
  "pay.view": "View Spurs Pay checkout activity and statistics",
  "pay.write": "Perform operational actions in Spurs Pay",
  "pay.approve": "Approve sensitive Spurs Pay actions",
  "pay.providers.manage": "Manage Spurs Pay provider credentials",
  "pay.policy.manage": "Manage Spurs Pay fees, limits and checkout policy",
  "pay.service_clients.manage": "Manage Accounts clients allowed to call the Pay service API",
  "blockbusters.view": "View Block Busters titles, upload queue and statistics",
  "blockbusters.write": "Create and edit Block Busters titles and upload media",
  "blockbusters.publish": "Publish and unpublish Block Busters titles",
  "blockbusters.delete": "Delete Block Busters titles",
  "admins.manage": "Manage admin users",
  "roles.manage": "Manage admin roles",
  "settings.manage": "Manage global settings",
} as const;

export type PermissionName = keyof typeof PERMISSION_CATALOG;

export const PERMISSION_DASHBOARD: Record<PermissionName, string> = {
  "accounts.view": "accounts",
  "accounts.create": "accounts",
  "accounts.suspend": "accounts",
  "accounts.verify": "accounts",
  "accounts.revoke_sessions": "accounts",
  "accounts.settings": "accounts",
  "accounts.oidc_clients.manage": "accounts",
  "pay.view": "pay",
  "pay.write": "pay",
  "pay.approve": "pay",
  "pay.providers.manage": "pay",
  "pay.policy.manage": "pay",
  "pay.service_clients.manage": "pay",
  "blockbusters.view": "blockbusters",
  "blockbusters.write": "blockbusters",
  "blockbusters.publish": "blockbusters",
  "blockbusters.delete": "blockbusters",
  "admins.manage": "default",
  "roles.manage": "default",
  "settings.manage": "default",
};

type RoleAccess = { dashboards: string[]; permissions: string[] };

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

export function canGrant(actor: RoleAccess, role: RoleAccess) {
  if (isSuperAdmin(actor.permissions)) return true;
  if (role.permissions.includes(ALL_PERMISSIONS) || role.dashboards.includes(ALL_ACCESS)) {
    return false;
  }
  return (
    role.permissions.every((permission) => hasPermission(actor.permissions, permission)) &&
    role.dashboards.every((dashboard) => canAccessDashboard(actor.dashboards, dashboard))
  );
}
