import {
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { canAccessDashboard } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Only visible to admins with full access (managing admins and roles). */
  superOnly?: boolean;
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
      { title: "Admin users", href: "/users", icon: Users, superOnly: true },
      { title: "Roles", href: "/roles", icon: ShieldCheck, superOnly: true },
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

export function firstAccessibleDashboard(allowed: string[]): Dashboard | null {
  return DASHBOARDS.find((d) => canAccessDashboard(allowed, d.slug)) ?? null;
}

export function isSuperOnlyPath(pathname: string) {
  return DASHBOARDS.some((d) =>
    d.nav.some(
      (item) =>
        item.superOnly &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    ),
  );
}
