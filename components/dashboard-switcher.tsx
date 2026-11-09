"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";

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

export function DashboardSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const current = getDashboard(pathname);

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
          {DASHBOARDS.map((dashboard) => (
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
