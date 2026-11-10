"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { RoleForm, type RoleInput } from "@/components/role-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createRole } from "@/lib/admin-api";

export default function NewRolePage() {
  const router = useRouter();

  async function create(input: RoleInput) {
    await createRole(input);
    toast.success("Role created.");
    router.push("/roles");
  }

  return (
    <div className="w-full space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/roles" />}>
        <ArrowLeft /> Back to roles
      </Button>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New role</h2>
        <p className="text-sm text-muted-foreground">
          Choose which dashboards and actions this role can access.
        </p>
      </div>

      <Card>
        <CardContent className="p-3 px-5">
          <RoleForm
            variant="split"
            submitLabel="Create role"
            onSubmit={create}
            onCancel={() => router.push("/roles")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
