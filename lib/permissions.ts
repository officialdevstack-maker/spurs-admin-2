export const ALL_ACCESS = "*";

export function isSuperAdmin(dashboards: string[]) {
  return dashboards.includes(ALL_ACCESS);
}

export function canAccessDashboard(dashboards: string[], slug: string) {
  return isSuperAdmin(dashboards) || dashboards.includes(slug);
}
