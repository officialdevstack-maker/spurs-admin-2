"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockbustersRequest, getErrorMessage } from "@/lib/blockbusters-api";

type QueueVideo = {
  id: string;
  titleId: string;
  title: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  durationSec: number | null;
  createdAt: string;
};

export default function BlockbustersQueuePage() {
  const [videos, setVideos] = React.useState<QueueVideo[]>([]);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const result = await blockbustersRequest<{ data: QueueVideo[] }>("queue");
      setVideos(result.data);
      setError(null);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function retry(videoId: string) {
    try {
      await blockbustersRequest(`videos/${videoId}/retry`, {
        write: true,
        method: "POST",
        body: { reason },
      });
      setReason("");
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transcode queue</h1>
        <p className="text-sm text-muted-foreground">Uploading, uploaded, processing and failed videos.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Input aria-label="Reason for retry" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Reason required to retry a failed video" value={reason} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr className="border-t align-top" key={video.id}>
                <td className="px-4 py-3 font-medium">
                  <Link className="hover:text-primary" href={`/blockbusters/titles/${video.titleId}/video`}>{video.title}</Link>
                </td>
                <td className="px-4 py-3 capitalize">{video.status}</td>
                <td className="px-4 py-3">{video.attempts}</td>
                <td className="px-4 py-3">{new Date(video.createdAt).toLocaleString()}</td>
                <td className="max-w-sm px-4 py-3 text-muted-foreground">{video.errorMessage ?? "—"}</td>
                <td className="px-4 py-3">
                  {video.status === "failed" && (
                    <Button disabled={reason.trim().length < 3} onClick={() => void retry(video.id)} size="sm" variant="outline">Retry</Button>
                  )}
                </td>
              </tr>
            ))}
            {videos.length === 0 && <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={6}>No active or failed jobs.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
