"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AppNavbar } from "@/components/app-navbar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { canAccessDashboard, hasPermission } from "@/lib/permissions";
import { getDashboard, landingHref, requiredPermissionForPath } from "@/lib/dashboards";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </React.Suspense>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, logout } = useAuth();
  const dashboards = user?.dashboards ?? [];
  const permissions = user?.permissions ?? [];
  const landing = user ? landingHref(dashboards, permissions) : null;
  const requiredPermission = requiredPermissionForPath(pathname);
  const permitted =
    !!user &&
    canAccessDashboard(dashboards, getDashboard(pathname).slug) &&
    (!requiredPermission || hasPermission(permissions, requiredPermission));

  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!permitted && landing && landing !== pathname) router.replace(landing);
  }, [landing, pathname, permitted, ready, router, user]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!landing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">No access</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account is active but has no dashboards or permissions assigned. Ask an admin to
          assign you a role.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await logout();
              router.replace("/login");
            } catch (error) {
              console.error("Could not sign out from the no-access page:", error);
            }
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  if (!permitted) {
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
        <AppNavbar />
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
