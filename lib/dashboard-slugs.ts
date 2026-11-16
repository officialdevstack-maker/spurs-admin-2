export const DASHBOARD_SLUGS = ["default", "accounts", "pay"] as const;

export function isDashboardSlug(value: string) {
  return value === "*" || DASHBOARD_SLUGS.some((slug) => slug === value);
}
