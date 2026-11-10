"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARDS } from "@/lib/dashboards";
import { listRoles, updateRole, type AdminRole } from "@/lib/admin-api";
import { RoleForm, type RoleInput } from "@/components/role-form";
import { canGrant, PERMISSION_CATALOG } from "@/lib/permissions";

const editButtonClass = "h-8 rounded-md border border-border bg-background px-3 text-xs";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

function RoleBadges({ dashboards, permissions }: { dashboards: string[]; permissions: string[] }) {
  const dashboardBadges = dashboards.includes("*") ? (
    <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">All dashboards</span>
  ) : (
    dashboards.map((slug) => {
      const label = DASHBOARDS.find((dashboard) => dashboard.slug === slug)?.name ?? slug;
      return (
        <span key={slug} className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {label}
        </span>
      );
    })
  );

  const permissionBadges = permissions.includes("*")
    ? [<span key="all-permissions" className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">All permissions</span>]
    : permissions.length
      ? permissions.map((slug) => (
          <span key={slug} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {PERMISSION_CATALOG[slug as keyof typeof PERMISSION_CATALOG] ?? slug}
          </span>
        ))
      : [<span key="none" className="rounded-full bg-muted px-2 py-0.5 text-xs">No action permissions</span>];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">{dashboardBadges}</div>
      <div className="flex flex-wrap gap-1.5">{permissionBadges}</div>
    </div>
  );
}

export default function AdminRoles() {
  const { user } = useAuth();
  const actor = {
    dashboards: user?.dashboards ?? [],
    permissions: user?.permissions ?? [],
  };
  const [roles, setRoles] = React.useState<AdminRole[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AdminRole | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    listRoles()
      .then((response) => {
        if (!active) return;
        setRoles(response.data);
        setError(null);
      })
      .catch((e) => active && setError(msg(e)));
    return () => {
      active = false;
    };
  }, [reload]);

  async function saveRole(input: RoleInput) {
    if (!editing) return;
    await updateRole(editing.id, input);
    toast.success("Role updated.");
    setEditing(null);
    setReload((v) => v + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Roles</h2>
          <p className="text-sm text-muted-foreground">Control access to dashboard sections.</p>
        </div>
        <Button render={<Link href="/roles/new" />}>
          <Plus className="mr-2 size-4" /> New role
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles === null && !error ? (
              Array.from({ length: 4 }, (_, index) => (
                <tr key={index}>
                  <td colSpan={4} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : roles?.length ? (
              roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {role.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadges dashboards={role.dashboards} permissions={role.permissions ?? []} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {role.name.toLowerCase() === "super admin" ? (
                        <span className="text-xs text-muted-foreground">Protected</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={editButtonClass}
                          disabled={
                            role.name.toLowerCase() === user?.role?.toLowerCase() ||
                            !canGrant(actor, {
                              dashboards: role.dashboards,
                              permissions: role.permissions ?? [],
                            })
                          }
                          title={
                            role.name.toLowerCase() === user?.role?.toLowerCase()
                              ? "You can't edit the role assigned to your account"
                              : canGrant(actor, {
                                  dashboards: role.dashboards,
                                  permissions: role.permissions ?? [],
                                })
                                ? undefined
                                : "This role has more access than you do"
                          }
                          onClick={() => {
                            setEditing(role);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No roles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>Update the role and its access.</DialogDescription>
          </DialogHeader>
          {editing && (
            <RoleForm
              key={editing.id}
              editing={editing}
              submitLabel="Save role"
              onSubmit={saveRole}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
