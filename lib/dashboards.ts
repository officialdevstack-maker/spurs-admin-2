import {
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { canAccessDashboard, type PermissionName } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: PermissionName;
  /** Items sharing a group render under one sidebar label. */
  group?: string;
};

export type Dashboard = {
  slug: string;
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
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
  {
    slug: "accounts",
    name: "Accounts",
    description: "Accounts admin dashboard",
    basePath: "/accounts",
    nav: [
      { title: "Overview", href: "/accounts", icon: LayoutDashboard },
      { title: "Accounts", href: "/accounts/list", icon: Wallet },
      { title: "Transactions", href: "/accounts/transactions", icon: Receipt },
      { title: "Settings", href: "/accounts/settings", icon: Settings },
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
  for (const dashboard of DASHBOARDS) {
    const item = dashboard.nav.find(
      (navItem) =>
        navItem.requiredPermission &&
        (pathname === navItem.href || pathname.startsWith(`${navItem.href}/`)),
    );
    if (item?.requiredPermission) return item.requiredPermission;
  }
  return null;
}
