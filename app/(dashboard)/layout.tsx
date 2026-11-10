"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { canAccessDashboard, isSuperAdmin } from "@/lib/permissions";
import { firstAccessibleDashboard, getDashboard, isSuperOnlyPath } from "@/lib/dashboards";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useAuth();

  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    const dashboard = getDashboard(pathname);
    const allowed = user.dashboards ?? [];
    const navigateToFirstAccessible = () => {
      const first = firstAccessibleDashboard(allowed);
      router.replace(first?.basePath ?? "/login");
    };

    if (!canAccessDashboard(allowed, dashboard.slug)) {
      navigateToFirstAccessible();
      return;
    }

    if (isSuperOnlyPath(pathname) && !isSuperAdmin(allowed)) {
      navigateToFirstAccessible();
    }
  }, [pathname, ready, router, user]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 bg-card px-4 shadow-sm">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <DashboardSwitcher />
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
