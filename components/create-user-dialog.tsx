"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";

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
import { createUser, type AccountType, type ApiUser } from "@/lib/accounts-api";
import { ApiError } from "@/lib/api";

type FormState = {
  fullname: string;
  email: string;
  phone: string;
  password: string;
  accountType: AccountType;
  isVerified: boolean;
  sendWelcome: boolean;
};

const INITIAL: FormState = {
  fullname: "",
  email: "",
  phone: "",
  password: "",
  accountType: "user",
  isVerified: false,
  sendWelcome: true,
};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function generatePassword(length = 14) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CHARS[byte % CHARS.length]).join("");
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: ApiUser) => void;
}) {
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<ApiUser | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    const errorKey = key === "accountType" ? "account_type" : key;
    setErrors((current) => {
      if (!(errorKey in current)) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };

  function changeOpen(next: boolean) {
    if (submitting) return;
    if (next) {
      setForm(INITIAL);
      setShowPassword(false);
      setErrors({});
      setFormError(null);
      setCreated(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const user = await createUser({
        fullname: form.fullname.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        account_type: form.accountType,
        is_verified: form.isVerified,
        send_welcome: form.sendWelcome,
      });
      setCreated(user);
      onCreated(user);
    } catch (cause) {
      if (cause instanceof ApiError && cause.errors) setErrors(cause.errors);
      setFormError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(form.password);
      setFormError(null);
    } catch {
      setFormError("Could not copy the password. Select and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "User created" : "New user"}</DialogTitle>
          <DialogDescription>
            {created
              ? `${created.fullname} can now sign in with this password. Share it securely.`
              : "Create a user account on the accounts service. The account will not have admin access."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{created.fullname}</p>
              <p className="text-sm text-muted-foreground">{created.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="created-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="created-password"
                  readOnly
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
                <Button type="button" size="icon" variant="outline" aria-label="Copy password" onClick={() => void copyPassword()}>
                  <Copy />
                </Button>
              </div>
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                <Check /> Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <form id="create-user-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cu-fullname">Full name</Label>
                <Input
                  id="cu-fullname"
                  autoComplete="off"
                  placeholder="First Last"
                  value={form.fullname}
                  onChange={(event) => set("fullname", event.target.value)}
                  aria-invalid={Boolean(errors.fullname)}
                  required
                />
                <FieldError messages={errors.fullname} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cu-email">Email address</Label>
                <Input
                  id="cu-email"
                  type="email"
                  autoComplete="off"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  required
                />
                <FieldError messages={errors.email} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cu-phone">Phone (optional)</Label>
                  <Input
                    id="cu-phone"
                    type="tel"
                    autoComplete="off"
                    placeholder="+234 800 000 0000"
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  <FieldError messages={errors.phone} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cu-type">Account type</Label>
                  <select
                    id="cu-type"
                    className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                    value={form.accountType}
                    onChange={(event) => set("accountType", event.target.value as AccountType)}
                  >
                    <option value="user">User</option>
                    <option value="business">Business</option>
                    <option value="developer">Developer</option>
                  </select>
                  <FieldError messages={errors.account_type} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cu-password">Password</Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id="cu-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="pr-9"
                      value={form.password}
                      onChange={(event) => set("password", event.target.value)}
                      aria-invalid={Boolean(errors.password)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      set("password", generatePassword());
                      setShowPassword(true);
                    }}
                  >
                    <RefreshCw /> Generate
                  </Button>
                </div>
                <FieldError messages={errors.password} />
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isVerified}
                    onChange={(event) => set("isVerified", event.target.checked)}
                  />
                  Mark email as verified
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.sendWelcome}
                    onChange={(event) => set("sendWelcome", event.target.checked)}
                  />
                  Send welcome email
                </label>
              </div>

              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            </form>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-user-form" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                {submitting ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
