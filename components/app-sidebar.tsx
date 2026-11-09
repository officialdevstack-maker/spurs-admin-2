"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  ExternalLink,
  Globe,
  KeyRound,
  LogOut,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getDashboard } from "@/lib/dashboards";
import { SUBDOMAINS, subdomainUrl } from "@/lib/subdomains";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [pwOpen, setPwOpen] = React.useState(false);
  const dashboard = getDashboard(pathname);

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href={dashboard.basePath} />}>
                <>
                  <div className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                    <Globe className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Admin Panel</span>
                    <span className="truncate text-xs text-muted-foreground">{dashboard.name}</span>
                  </div>
                </>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{dashboard.name}</SidebarGroupLabel>
            <SidebarMenu>
              {dashboard.nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="h-10 rounded-full px-3 font-medium"
                  >
                    <>
                      <item.icon />
                      <span>{item.title}</span>
                    </>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          {dashboard.slug === "default" && (
            <SidebarGroup>
              <SidebarGroupLabel>Subdomains</SidebarGroupLabel>
              <SidebarMenu>
                {SUBDOMAINS.map((s) => (
                  <SidebarMenuItem key={s.slug}>
                    <SidebarMenuButton
                      render={<a href={subdomainUrl(s.slug)} target="_blank" rel="noopener noreferrer" />}
                      tooltip={s.name}
                      className="h-10 rounded-full px-3 font-medium"
                    >
                      <>
                        <ExternalLink />
                        <span>{s.name}</span>
                      </>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton size="lg">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">{user?.name?.[0] ?? "A"}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                    </SidebarMenuButton>
                  }
                />
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onSelect={() => setPwOpen(true)}>
                    <KeyRound className="mr-2 size-4" />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      logout();
                      router.replace("/login");
                    }}
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}
