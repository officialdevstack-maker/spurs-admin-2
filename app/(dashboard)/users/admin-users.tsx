"use client";

import * as React from "react";
import { Loader2, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

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
import {
  createAdmin,
  listAdmins,
  listRoles,
  updateAdmin,
  type AdminRole,
  type AdminRow,
} from "@/lib/admin-api";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export default function AdminUsers() {
  const [admins, setAdmins] = React.useState<AdminRow[] | null>(null);
  const [roles, setRoles] = React.useState<AdminRole[]>([]);
  const [currentId, setCurrentId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    Promise.all([listAdmins(), listRoles()])
      .then(([a, r]) => {
        if (!active) return;
        setAdmins(a.data);
        setCurrentId(a.currentId);
        setRoles(r.data);
        setError(null);
      })
      .catch((e) => active && setError(msg(e)));
    return () => {
      active = false;
    };
  }, [reload]);

  async function change(id: number, changes: { roleId?: number; suspended?: boolean }) {
    setBusy(id);
    try {
      await updateAdmin(id, changes);
      toast.success("Admin updated.");
      setReload((v) => v + 1);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Admin users</h2>
          <p className="text-sm text-muted-foreground">Manage who can sign in to this panel.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!roles.length}>
          <Plus className="mr-2 size-4" /> New admin
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {admins === null && !error ? (
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : admins?.length ? (
              admins.map((a) => {
                const self = a.id === currentId;
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {a.fullname}
                        {self && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${a.fullname}`}
                        className={selectClass + " max-w-48"}
                        value={a.roleId ?? ""}
                        disabled={self || busy === a.id}
                        onChange={(e) => void change(a.id, { roleId: Number(e.target.value) })}
                      >
                        {a.roleId === null && <option value="">No role</option>}
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {a.suspendedAt ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          Suspended
                        </span>
                      ) : (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {!self && (
                          <Button
                            size="sm"
                            variant={a.suspendedAt ? "outline" : "destructive"}
                            disabled={busy === a.id}
                            onClick={() => {
                              if (!a.suspendedAt && !window.confirm(`Suspend ${a.fullname}?`)) return;
                              void change(a.id, { suspended: !a.suspendedAt });
                            }}
                          >
                            {busy === a.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : a.suspendedAt ? (
                              <ShieldCheck className="mr-2 size-4" />
                            ) : (
                              <ShieldOff className="mr-2 size-4" />
                            )}
                            {a.suspendedAt ? "Restore" : "Suspend"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No admins found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewAdminDialog
        open={open}
        onOpenChange={setOpen}
        roles={roles}
        onCreated={() => setReload((v) => v + 1)}
      />
    </div>
  );
}

function NewAdminDialog({
  open,
  onOpenChange,
  roles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: AdminRole[];
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({
    fullname: "",
    email: "",
    password: "",
    roleId: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm({ fullname: "", email: "", password: "", roleId: roles[0]?.id ? String(roles[0].id) : "" });
      setError(null);
    }
  }, [open, roles]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createAdmin({ ...form, roleId: Number(form.roleId) });
      toast.success(`${form.fullname} was created.`);
      onOpenChange(false);
      onCreated();
    } catch (cause) {
      setError(msg(cause));
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New admin</DialogTitle>
            <DialogDescription>They can sign in to the panel with these credentials.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="a-name">Full name</Label>
            <Input id="a-name" required value={form.fullname} onChange={set("fullname")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-email">Email</Label>
            <Input id="a-email" type="email" required value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-pass">Password</Label>
            <Input
              id="a-pass"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
            />
            <p className="text-xs text-muted-foreground">At least 12 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-role">Role</Label>
            <select
              id="a-role"
              className={selectClass}
              required
              value={form.roleId}
              onChange={set("roleId")}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
