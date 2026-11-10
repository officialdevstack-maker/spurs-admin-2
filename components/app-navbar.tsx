"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getDashboard } from "@/lib/dashboards";

type Crumb = { label: string; href: string };

const humanize = (segment: string) => {
  if (/^\d+$/.test(segment)) return `#${segment}`;
  const text = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function buildCrumbs(pathname: string): Crumb[] {
  const dashboard = getDashboard(pathname);
  const titles = new Map(dashboard.nav.map((item) => [item.href, item.title]));
  const crumbs: Crumb[] = [{ label: dashboard.name, href: dashboard.basePath }];

  if (pathname === dashboard.basePath) {
    const home = titles.get(dashboard.basePath);
    if (home) crumbs.push({ label: home, href: pathname });
    return crumbs;
  }

  let href = "";
  for (const segment of pathname.split("/").filter(Boolean)) {
    href += `/${segment}`;
    if (href === dashboard.basePath) continue;
    crumbs.push({ label: titles.get(href) ?? humanize(segment), href });
  }

  return crumbs;
}

function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
              {last ? (
                <span aria-current="page" className="truncate font-medium">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Change theme" />}
      >
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" />
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" />
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" />
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Account menu"
            className="rounded-full"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid gap-0.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{user?.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
            {user?.role && (
              <span className="mt-1 w-fit rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                {user.role}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            try {
              await logout();
              router.replace("/login");
            } catch {
              toast.error("Could not sign out. Please try again.");
            }
          }}
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppNavbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-card px-4 shadow-sm">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <DashboardSwitcher />
      <Separator orientation="vertical" className="hidden h-4 md:block" />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1">
        <ThemeMenu />
        <UserMenu />
      </div>
    </header>
  );
}
