import {
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };

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
      { title: "Users", href: "/users", icon: Users },
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
