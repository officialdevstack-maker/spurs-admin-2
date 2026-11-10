"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARDS } from "@/lib/dashboards";
import { createRole, listRoles, updateRole, type AdminRole } from "@/lib/admin-api";
import {
  canAccessDashboard,
  canGrant,
  hasPermission,
  isSuperAdmin,
  PERMISSION_CATALOG,
  PERMISSION_DASHBOARD,
  type PermissionName,
} from "@/lib/permissions";

const labelClass = "text-sm font-medium";
const editButtonClass = "h-8 rounded-md border border-border bg-background px-3 text-xs";

const dashboardOptions = DASHBOARDS.map((dashboard) => ({
  slug: dashboard.slug,
  label: dashboard.name,
}));
const permissionOptions = Object.entries(PERMISSION_CATALOG);

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
  const [open, setOpen] = React.useState(false);
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

  async function saveRole(input: { name: string; description: string; dashboards: string[]; permissions?: string[] }) {
    if (editing) {
      await updateRole(editing.id, input);
      toast.success("Role updated.");
    } else {
      await createRole(input);
      toast.success("Role created.");
    }
    setOpen(false);
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
        <Button onClick={() => setOpen(true)}>
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
                            setOpen(true);
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

      <RoleDialog
        key={open ? `open-${editing?.id ?? "new"}` : "closed"}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
        editing={editing}
        onSubmit={saveRole}
      />
    </div>
  );
}

function RoleDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdminRole | null;
  onSubmit: (input: {
    name: string;
    description: string;
    dashboards: string[];
    permissions?: string[];
  }) => Promise<void>;
}) {
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.permissions);
  const availableDashboards = DASHBOARDS.filter((dashboard) =>
    canAccessDashboard(user?.dashboards, dashboard.slug),
  );
  const permissionGroups = DASHBOARDS.map((dashboard) => ({
    dashboard,
    items: permissionOptions.filter(
      ([slug]) =>
        PERMISSION_DASHBOARD[slug as PermissionName] === dashboard.slug &&
        hasPermission(user?.permissions, slug) &&
        canAccessDashboard(user?.dashboards, dashboard.slug),
    ),
  })).filter((group) => group.items.length);
  const [name, setName] = React.useState(editing?.name ?? "");
  const [description, setDescription] = React.useState(editing?.description ?? "");
  const [selected, setSelected] = React.useState<string[]>(
    () =>
      editing?.dashboards ??
      (isSuper
        ? ["*"]
        : availableDashboards.map((dashboard) => dashboard.slug)),
  );
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>(
    editing?.permissions ?? [],
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleDashboard(slug: string) {
    setSelected((current) => {
      if (slug === "*") {
        return current.includes("*") ? [] : ["*"];
      }
      const withoutStar = current.filter((value) => value !== "*");
      if (current.includes(slug)) return withoutStar.filter((value) => value !== slug);
      return [...withoutStar, slug];
    });
  }

  const allPermissions = selectedPermissions.includes("*");

  function toggleAllPermissions() {
    setSelectedPermissions((current) => (current.includes("*") ? [] : ["*"]));
  }

  function togglePermission(slug: string) {
    if (selectedPermissions.includes(slug)) {
      setSelectedPermissions((current) => current.filter((value) => value !== slug));
      return;
    }
    setSelectedPermissions((current) => [...current, slug]);
    const dashboard = PERMISSION_DASHBOARD[slug as PermissionName];
    setSelected((current) =>
      current.includes("*") || current.includes(dashboard)
        ? current
        : [...current, dashboard],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!name.trim()) {
      setError("Role name is required.");
      setSaving(false);
      return;
    }
    if (!selected.length) {
      setError("Choose at least one dashboard.");
      setSaving(false);
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        dashboards: selected,
        permissions: selectedPermissions,
      });
    } catch (cause) {
      setError(msg(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the role and dashboard access." : "Create a new admin role."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="role-name" className={labelClass}>
              Name
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Operations manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-desc" className={labelClass}>
              Description
            </Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Can manage accounts and settings"
            />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Dashboards</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {isSuper && (
                <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes("*")}
                    onChange={() => toggleDashboard("*")}
                  />
                  <span>All dashboards</span>
                </label>
              )}

              {dashboardOptions
                .filter((dashboard) =>
                  canAccessDashboard(user?.dashboards, dashboard.slug),
                )
                .map((dashboard) => (
                <label key={dashboard.slug} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(dashboard.slug)}
                    onChange={() => toggleDashboard(dashboard.slug)}
                    disabled={selected.includes("*") && !selected.includes(dashboard.slug)}
                  />
                  <span>{dashboard.label}</span>
                </label>
                ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className={labelClass}>Action permissions</Label>
            {isSuper && (
              <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={allPermissions}
                  onChange={toggleAllPermissions}
                />
                <span>All permissions</span>
              </label>
            )}
            {permissionGroups.map(({ dashboard, items }) => (
              <div key={dashboard.slug} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {dashboard.name} dashboard
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map(([slug, label]) => (
                    <label key={slug} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={allPermissions || selectedPermissions.includes(slug)}
                        disabled={allPermissions}
                        onChange={() => togglePermission(slug)}
                      />
                      <span>
                        <span className="block font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{slug}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Selecting a permission also grants the dashboard it belongs to.
            </p>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? "Save role" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
