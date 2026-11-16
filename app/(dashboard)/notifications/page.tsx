import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Check,
  Clock3,
  LoaderCircle,
  Mail,
  MessageSquare,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPool } from "@/lib/db";
import { canAccessDashboard, hasPermission } from "@/lib/permissions";
import { getAdmin } from "@/lib/session";

type QueueCounts = {
  pending: string;
  processing: string;
  sent: string;
  failed: string;
};

type RecentJob = {
  id: number;
  channel: "mail" | "sms";
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  createdAt: Date;
};

const summaryCards = [
  { key: "pending", label: "Waiting", icon: Clock3 },
  { key: "processing", label: "Processing", icon: LoaderCircle },
  { key: "sent", label: "Sent", icon: Check },
  { key: "failed", label: "Failed", icon: AlertTriangle },
] as const;

const statusStyles: Record<RecentJob["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-destructive/10 text-destructive",
};

export default async function NotificationsPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");

  if (
    !canAccessDashboard(admin.dashboards, "default") ||
    !hasPermission(admin.permissions, "settings.manage")
  ) {
    return (
      <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
        You don&apos;t have permission to view notification activity.
      </div>
    );
  }

  let counts: QueueCounts;
  let recentJobs: RecentJob[];
  try {
    const [summary, activity] = await Promise.all([
      getPool().query<QueueCounts>(
        `select count(*) filter (where status = 'pending')::text as pending,
                count(*) filter (where status = 'processing')::text as processing,
                count(*) filter (where status = 'sent')::text as sent,
                count(*) filter (where status = 'failed')::text as failed
         from notification_jobs`,
      ),
      getPool().query<RecentJob>(
        `select id, channel, status, attempts, created_at as "createdAt"
         from notification_jobs
         order by created_at desc
         limit 10`,
      ),
    ]);
    counts = summary.rows[0] ?? { pending: "0", processing: "0", sent: "0", failed: "0" };
    recentJobs = activity.rows;
  } catch (error) {
    console.error("Could not load notification activity:", error);
    return (
      <div className="space-y-6">
        <PageHeading />
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          Notification activity is unavailable. Check the database connection and that the
          notifications migration has been applied.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="rounded-2xl ring-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>{label}</CardDescription>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{Number(counts[key]).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl ring-0">
        <CardHeader>
          <CardTitle>Recent delivery activity</CardTitle>
          <CardDescription>
            Latest email and SMS jobs submitted by connected apps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Bell className="size-8 text-muted-foreground" />
              <p className="font-medium">No notification activity yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Once a connected app submits a notification, its delivery status will appear here.
                See the{" "}
                <Link
                  href="/settings"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  email settings
                </Link>{" "}
                to configure email delivery.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentJobs.map((job) => {
                const ChannelIcon = job.channel === "mail" ? Mail : MessageSquare;
                return (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-muted">
                        <ChannelIcon className="size-4 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {job.channel === "mail" ? "Email" : "SMS"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(job.createdAt)}
                          {" · "}
                          {job.attempts} {job.attempts === 1 ? "attempt" : "attempts"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[job.status]}`}
                    >
                      {job.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
      <p className="text-sm text-muted-foreground">
        Monitor delivery health for email and SMS sent by connected apps.
      </p>
    </div>
  );
}
