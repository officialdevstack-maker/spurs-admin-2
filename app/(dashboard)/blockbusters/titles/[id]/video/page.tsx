"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockbustersRequest, getErrorMessage } from "@/lib/blockbusters-api";

type UploadPart = { PartNumber: number; url: string };
type UploadPlan = {
  videoId: string;
  uploadId: string | null;
  uploadUrl?: string;
  partSize?: number;
  parts?: UploadPart[];
};
type Video = {
  id: string;
  status: string;
  attempts: number;
  durationSec: number | null;
  errorMessage: string | null;
};

function putFile(url: string, file: Blob, contentType: string, progress?: (loaded: number) => void, xhrs?: XMLHttpRequest[]) {
  return new Promise<string | null>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress?.(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader("ETag"));
      else reject(new Error(`Upload failed with status ${xhr.status}.`));
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhrs?.push(xhr);
    xhr.send(file);
  });
}

const videoTypeByExtension: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  webm: "video/webm",
};

export default function BlockbustersVideoPage() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = React.useState<File | null>(null);
  const [video, setVideo] = React.useState<Video | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const activeXhrs = React.useRef<XMLHttpRequest[]>([]);
  const activePlan = React.useRef<UploadPlan | null>(null);
  const cancelled = React.useRef(false);

  const pollVideo = React.useCallback(async (videoId: string) => {
    const result = await blockbustersRequest<{ data: Video }>(`videos/${videoId}`);
    setVideo(result.data);
    return result.data;
  }, []);

  React.useEffect(() => {
    if (!video?.id || ["ready", "failed"].includes(video.status)) return;
    let active = true;
    const timer = window.setInterval(() => {
      void pollVideo(video.id).catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollVideo, video?.id, video?.status]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    setMessage(null);
    cancelled.current = false;
    activeXhrs.current = [];
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = file.type || videoTypeByExtension[extension] || "";
    try {
      if (!videoTypeByExtension[extension] || contentType !== videoTypeByExtension[extension]) {
        throw new Error("Choose an MP4, MOV, MKV or WebM video with a supported file type.");
      }
      const initialized = await blockbustersRequest<{ data: UploadPlan }>("uploads/init", {
        write: true,
        method: "POST",
        body: { titleId: id, filename: file.name, size: file.size, contentType },
      });
      const plan = initialized.data;
      activePlan.current = plan;
      setVideo({ id: plan.videoId, status: "uploading", attempts: 0, durationSec: null, errorMessage: null });
      if (plan.uploadUrl) {
        await putFile(plan.uploadUrl, file, contentType, (loaded) => {
          setProgress(Math.round((loaded / file.size) * 100));
        }, activeXhrs.current);
      } else {
        const parts = plan.parts ?? [];
        const results: Array<{ PartNumber: number; ETag: string }> = [];
        let nextIndex = 0;
        let completedBytes = 0;
        const completedByPart = new Map<number, number>();
        const uploadPart = async (part: UploadPart) => {
          const start = (part.PartNumber - 1) * (plan.partSize ?? 0);
          const end = Math.min(file.size, start + (plan.partSize ?? 0));
          const blob = file.slice(start, end);
          let etag: string | null = null;
          let lastError: unknown;
          for (let attempt = 0; attempt < 3 && !etag; attempt += 1) {
            try {
              etag = await putFile(part.url, blob, contentType, (loaded) => {
                completedByPart.set(part.PartNumber, loaded);
                const loadedTotal = [...completedByPart.values()].reduce((sum, value) => sum + value, completedBytes);
                setProgress(Math.min(99, Math.round((loadedTotal / file.size) * 100)));
              }, activeXhrs.current);
            } catch (cause) {
              lastError = cause;
              if (cancelled.current) throw cause;
            }
          }
          if (!etag) throw lastError instanceof Error ? lastError : new Error("Could not upload a video part.");
          completedBytes += blob.size;
          completedByPart.delete(part.PartNumber);
          results.push({ PartNumber: part.PartNumber, ETag: etag });
          setProgress(Math.min(99, Math.round((completedBytes / file.size) * 100)));
        };
        await Promise.all(Array.from({ length: Math.min(4, parts.length) }, async () => {
          while (!cancelled.current) {
            const index = nextIndex++;
            if (index >= parts.length) return;
            await uploadPart(parts[index]);
          }
        }));
        if (cancelled.current) throw new Error("Upload cancelled.");
        await blockbustersRequest("uploads/complete", {
          write: true,
          method: "POST",
          body: { videoId: plan.videoId, uploadId: plan.uploadId, parts: results },
        });
        activePlan.current = null;
      }
      if (plan.uploadUrl) {
        await blockbustersRequest("uploads/complete", {
          write: true,
          method: "POST",
          body: { videoId: plan.videoId, uploadId: null, parts: [] },
        });
        activePlan.current = null;
      }
      setProgress(100);
      setMessage("Upload complete. Transcoding has started.");
      await pollVideo(plan.videoId);
    } catch (cause) {
      setError(getErrorMessage(cause));
      const plan = activePlan.current;
      if (plan) {
        try {
          await blockbustersRequest("uploads/abort", {
            write: true,
            method: "POST",
            body: { videoId: plan.videoId },
          });
        } catch (cleanupError) {
          setError(`${getErrorMessage(cause)} Cleanup also failed: ${getErrorMessage(cleanupError)}`);
        }
        activePlan.current = null;
      }
    } finally {
      setBusy(false);
      activeXhrs.current = [];
    }
  }

  function cancel() {
    cancelled.current = true;
    activeXhrs.current.forEach((xhr) => xhr.abort());
  }

  async function retry() {
    if (!video) return;
    setError(null);
    try {
      const result = await blockbustersRequest<{ data: Video }>(`videos/${video.id}/retry`, {
        write: true,
        method: "POST",
        body: { reason },
      });
      setVideo({ ...video, ...result.data, errorMessage: null });
      setMessage("Video returned to the transcode queue.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href={`/blockbusters/titles/${id}`}>← Back to title</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Video upload</h1>
        <p className="text-sm text-muted-foreground">The browser uploads directly to private B2 storage.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <section className="space-y-4 rounded-lg border p-5">
        <label className="block space-y-2 text-sm font-medium">Source video
          <Input accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm" disabled={busy} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / (1024 ** 3)).toFixed(2)} GB</p>}
        {busy && <progress className="w-full" max={100} value={progress} />}
        <div className="flex gap-2">
          <Button disabled={!file || busy} onClick={() => void upload()}>{busy ? `Uploading ${progress}%` : "Upload video"}</Button>
          {busy && <Button onClick={cancel} type="button" variant="outline">Cancel</Button>}
        </div>
      </section>
      {video && (
        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="font-semibold">Latest video</h2>
          <p className="text-sm">Status: <span className="capitalize">{video.status}</span></p>
          <p className="text-sm text-muted-foreground">Attempts: {video.attempts}</p>
          {video.durationSec !== null && <p className="text-sm text-muted-foreground">Duration: {Math.floor(video.durationSec / 60)} min</p>}
          {video.errorMessage && <p role="alert" className="text-sm text-destructive">{video.errorMessage}</p>}
          {video.status === "failed" && (
            <div className="space-y-2 pt-2">
              <Input aria-label="Retry reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Reason for retry" value={reason} />
              <Button disabled={reason.trim().length < 3} onClick={() => void retry()}>Retry transcoding</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
