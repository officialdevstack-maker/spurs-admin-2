export const DASHBOARD_SLUGS = ["default", "accounts", "pay", "blockbusters"] as const;

export function isDashboardSlug(value: string) {
  return value === "*" || DASHBOARD_SLUGS.some((slug) => slug === value);
}
