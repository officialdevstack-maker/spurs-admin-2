"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DASHBOARDS, getDashboard } from "@/lib/dashboards";
import { canAccessDashboard } from "@/lib/permissions";

export function DashboardSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const allowed = user?.dashboards ?? [];
  const available = DASHBOARDS.filter((dashboard) => canAccessDashboard(allowed, dashboard.slug));
  const current = available.find((dashboard) => dashboard.slug === getDashboard(pathname).slug) ?? available[0] ?? getDashboard(pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="gap-1.5" />}
      >
        <span className="font-medium">{current.name}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Dashboards</DropdownMenuLabel>
          {available.map((dashboard) => (
            <DropdownMenuItem
              key={dashboard.slug}
              onClick={() => {
                if (dashboard.slug !== current.slug) router.push(dashboard.basePath);
              }}
            >
              <div className="grid flex-1 leading-tight">
                <span>{dashboard.name}</span>
                <span className="text-xs text-muted-foreground">
                  {dashboard.description}
                </span>
              </div>
              {dashboard.slug === current.slug && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
