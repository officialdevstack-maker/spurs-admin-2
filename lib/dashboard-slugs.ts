export const DASHBOARD_SLUGS = ["default", "accounts"] as const;

export function isDashboardSlug(value: string) {
  return value === "*" || DASHBOARD_SLUGS.includes(value as (typeof DASHBOARD_SLUGS)[number]);
}
