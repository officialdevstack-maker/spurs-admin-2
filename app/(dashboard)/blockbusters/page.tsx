"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Film, ListVideo, Upload } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { blockbustersRequest, getErrorMessage } from "@/lib/blockbusters-api";

type Stats = {
  titles: { total: number; published: number; drafts: number };
  videos: Record<string, number>;
  recentUploads: Array<{ id: string; title: string; status: string; createdAt: string }>;
  failedJobs: Array<{ id: string; titleId: string; title: string; attempts: number; errorMessage: string | null }>;
};

export default function BlockbustersPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    blockbustersRequest<{ data: Stats }>("stats")
      .then((result) => {
        if (active) setStats(result.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    { title: "Published titles", value: stats?.titles.published, icon: Film },
    { title: "Draft titles", value: stats?.titles.drafts, icon: Film },
    { title: "Videos processing", value: stats?.videos.processing ?? 0, icon: Upload },
    { title: "Failed videos", value: stats?.videos.failed ?? 0, icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Block Busters</h1>
        <p className="text-sm text-muted-foreground">
          Manage titles, uploads, publishing and transcoding.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="size-4" />
                {title}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {value === undefined ? "—" : value.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent uploads</CardTitle>
                <CardDescription>Latest video activity</CardDescription>
              </div>
              <Link className="inline-flex items-center gap-2 text-sm text-primary" href="/blockbusters/queue">
                <ListVideo className="size-4" />
                Queue
              </Link>
            </div>
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            {!stats && !error && <p className="text-sm text-muted-foreground">Loading uploads…</p>}
            {stats?.recentUploads.map((upload) => (
              <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-0" key={upload.id}>
                <span className="truncate text-sm font-medium">{upload.title}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{upload.status}</span>
              </div>
            ))}
            {stats?.recentUploads.length === 0 && <p className="text-sm text-muted-foreground">No uploads yet.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed jobs</CardTitle>
            <CardDescription>Videos that need attention</CardDescription>
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            {stats?.failedJobs.map((job) => (
              <Link
                className="block border-b pb-3 last:border-0 hover:text-primary"
                href={`/blockbusters/titles/${job.titleId}/video`}
                key={job.id}
              >
                <span className="block text-sm font-medium">{job.title}</span>
                <span className="text-xs text-muted-foreground">
                  {job.errorMessage || `Failed after ${job.attempts} attempt(s).`}
                </span>
              </Link>
            ))}
            {stats?.failedJobs.length === 0 && <p className="text-sm text-muted-foreground">No failed jobs.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
