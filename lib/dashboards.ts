import {
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { DASHBOARD_SLUGS } from "@/lib/dashboard-slugs";
import { canAccessDashboard, hasPermission, type PermissionName } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: PermissionName;
  /** Items sharing a group render under one sidebar label. */
  group?: string;
};

export type Dashboard = {
  slug: (typeof DASHBOARD_SLUGS)[number];
  name: string;
  description: string;
  basePath: string;
  nav: NavItem[];
};

export const DASHBOARDS: Dashboard[] = [
  {
    slug: "default",
    name: "Default",
    description: "Main admin dashboard",
    basePath: "/",
    nav: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      {
        title: "Admin users",
        href: "/users",
        icon: Users,
        requiredPermission: "admins.manage",
        group: "Administration",
      },
      {
        title: "Roles",
        href: "/roles",
        icon: ShieldCheck,
        requiredPermission: "roles.manage",
        group: "Administration",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        requiredPermission: "settings.manage",
      },
    ],
  },
  {
    slug: "accounts",
    name: "Accounts",
    description: "Accounts admin dashboard",
    basePath: "/accounts",
    nav: [
      {
        title: "Overview",
        href: "/accounts",
        icon: LayoutDashboard,
        requiredPermission: "accounts.view",
      },
      {
        title: "Accounts",
        href: "/accounts/list",
        icon: Wallet,
        requiredPermission: "accounts.view",
      },
      {
        title: "Transactions",
        href: "/accounts/transactions",
        icon: Receipt,
        requiredPermission: "accounts.view",
      },
      {
        title: "Settings",
        href: "/accounts/settings",
        icon: Settings,
        requiredPermission: "accounts.settings",
      },
    ],
  },
];

export function getDashboard(pathname: string): Dashboard {
  return (
    DASHBOARDS.find(
      (dashboard) =>
        dashboard.basePath !== "/" &&
        (pathname === dashboard.basePath ||
          pathname.startsWith(`${dashboard.basePath}/`)),
    ) ?? DASHBOARDS[0]
  );
}

export function groupNav(items: NavItem[]) {
  const sections: { label: string | null; items: NavItem[] }[] = [];
  for (const item of items) {
    const label = item.group ?? null;
    const last = sections[sections.length - 1];
    if (label && last?.label === label) last.items.push(item);
    else sections.push({ label, items: [item] });
  }
  return sections;
}

export function firstAccessibleDashboard(allowed: string[]): Dashboard | null {
  return DASHBOARDS.find((d) => canAccessDashboard(allowed, d.slug)) ?? null;
}

export function requiredPermissionForPath(pathname: string): PermissionName | null {
  let best: NavItem | null = null;
  for (const dashboard of DASHBOARDS) {
    for (const item of dashboard.nav) {
      const matches =
        pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
      if (matches && (!best || item.href.length > best.href.length)) best = item;
    }
  }
  return best?.requiredPermission ?? null;
}

export function firstAccessibleHref(dashboard: Dashboard, permissions: string[]) {
  return (
    dashboard.nav.find(
      (item) => !item.requiredPermission || hasPermission(permissions, item.requiredPermission),
    )?.href ?? null
  );
}

export function landingHref(dashboards: string[], permissions: string[]) {
  for (const dashboard of DASHBOARDS) {
    if (!canAccessDashboard(dashboards, dashboard.slug)) continue;
    const href = firstAccessibleHref(dashboard, permissions);
    if (href) return href;
  }
  return null;
}
