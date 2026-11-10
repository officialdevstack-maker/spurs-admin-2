"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminRole } from "@/lib/admin-api";
import { DASHBOARDS } from "@/lib/dashboards";
import {
  canAccessDashboard,
  hasPermission,
  isSuperAdmin,
  PERMISSION_CATALOG,
  PERMISSION_DASHBOARD,
  type PermissionName,
} from "@/lib/permissions";

export type RoleInput = {
  name: string;
  description: string;
  dashboards: string[];
  permissions: string[];
};

const msg = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
const permissionOptions = Object.entries(PERMISSION_CATALOG);

const optionClass =
  "flex items-start gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/40 has-[:checked]:bg-accent/40";

function Section({
  split,
  title,
  description,
  stackedTitle = true,
  children,
}: {
  split: boolean;
  title: string;
  description?: string;
  stackedTitle?: boolean;
  children: React.ReactNode;
}) {
  if (split) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {stackedTitle && <Label>{title}</Label>}
      {children}
    </div>
  );
}

export function RoleForm({
  editing = null,
  submitLabel,
  onSubmit,
  onCancel,
  variant = "stacked",
}: {
  editing?: AdminRole | null;
  submitLabel: string;
  onSubmit: (input: RoleInput) => Promise<void>;
  onCancel: () => void;
  variant?: "stacked" | "split";
}) {
  const split = variant === "split";
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user?.permissions);
  const dashboards = DASHBOARDS.filter(
    (dashboard) => isSuper || canAccessDashboard(user?.dashboards, dashboard.slug),
  );
  const permissionGroups = DASHBOARDS.map((dashboard) => ({
    dashboard,
    items: permissionOptions.filter(
      ([slug]) =>
        PERMISSION_DASHBOARD[slug as PermissionName] === dashboard.slug &&
        hasPermission(user?.permissions, slug) &&
        (isSuper || canAccessDashboard(user?.dashboards, dashboard.slug)),
    ),
  })).filter((group) => group.items.length);

  const [name, setName] = React.useState(editing?.name ?? "");
  const [description, setDescription] = React.useState(editing?.description ?? "");
  const [selected, setSelected] = React.useState<string[]>(editing?.dashboards ?? []);
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>(
    editing?.permissions ?? [],
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const allPermissions = selectedPermissions.includes("*");

  function toggleDashboard(slug: string) {
    setSelected((current) => {
      if (slug === "*") return current.includes("*") ? [] : ["*"];
      const withoutStar = current.filter((value) => value !== "*");
      return current.includes(slug)
        ? withoutStar.filter((value) => value !== slug)
        : [...withoutStar, slug];
    });
  }

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    if (!selected.length) {
      setError("Choose at least one dashboard.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        dashboards: selected,
        permissions: selectedPermissions,
      });
    } catch (cause) {
      setError(msg(cause));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className={split ? "space-y-6" : "space-y-5"}>
      <div className={split ? "grid items-start gap-6 lg:grid-cols-2" : "space-y-5"}>
        <div className={split ? "space-y-6" : "space-y-5"}>
          <Section
            split={split}
            title="Role details"
            description="Give the role a name people will recognise."
            stackedTitle={false}
          >
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Operations manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Can manage accounts and settings"
              />
            </div>
          </Section>

          <Section
            split={split}
            title="Dashboards"
            description="Which dashboards this role can open."
          >
            <div className="grid gap-3 p-1 sm:grid-cols-2">
              {isSuper && (
                <label className={optionClass}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes("*")}
                    onChange={() => toggleDashboard("*")}
                  />
                  <span>All dashboards</span>
                </label>
              )}
              {dashboards.map((dashboard) => (
                <label key={dashboard.slug} className={optionClass}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes("*") || selected.includes(dashboard.slug)}
                    disabled={selected.includes("*")}
                    onChange={() => toggleDashboard(dashboard.slug)}
                  />
                  <span>{dashboard.name}</span>
                </label>
              ))}
            </div>
          </Section>
        </div>

        <Section
          split={split}
          title="Action permissions"
          description="What this role is allowed to do. Selecting a permission also grants the dashboard it lives on."
        >
          {isSuper && (
            <label className={optionClass}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allPermissions}
                onChange={toggleAllPermissions}
              />
              <span>All permissions</span>
            </label>
          )}

          <div className="space-y-3">
            {permissionGroups.map(({ dashboard, items }) => (
              <div key={dashboard.slug} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{dashboard.name}</p>
                <div className="grid gap-3 p-1">
                  {items.map(([slug, label]) => (
                    <label key={slug} className={optionClass}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
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
          </div>
        </Section>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div
        className={
          split
            ? "flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3"
            : "flex justify-end gap-2"
        }
      >
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
