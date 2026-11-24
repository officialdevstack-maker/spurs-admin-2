"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BlockbustersApiError,
  blockbustersRequest,
  getErrorMessage,
} from "@/lib/blockbusters-api";

type VideoSummary = {
  id: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
};
type Title = {
  id: string;
  title: string;
  slug: string;
  year: number;
  rating: number | null;
  genre: string;
  type: "movie" | "series";
  durationMin: number | null;
  description: string | null;
  posterKey: string | null;
  backdropKey: string | null;
  posterUrl: string | null;
  published: boolean;
  latestVideo: VideoSummary | null;
};

function uploadFile(url: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Image upload failed with status ${xhr.status}.`));
    xhr.onerror = () => reject(new Error("Image upload failed."));
    xhr.send(file);
  });
}

export default function BlockbustersTitlePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = React.useState<Title | null>(null);
  const [values, setValues] = React.useState({
    title: "", slug: "", year: "", rating: "", genre: "", type: "movie",
    durationMin: "", description: "",
  });
  const [reason, setReason] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const result = await blockbustersRequest<{ data: Title }>(`titles/${params.id}`);
      setTitle(result.data);
      setValues({
        title: result.data.title,
        slug: result.data.slug,
        year: String(result.data.year),
        rating: result.data.rating === null ? "" : String(result.data.rating),
        genre: result.data.genre,
        type: result.data.type,
        durationMin: result.data.durationMin === null ? "" : String(result.data.durationMin),
        description: result.data.description ?? "",
      });
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function updateValue(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await blockbustersRequest<{ data: Title }>(`titles/${params.id}`, {
        write: true,
        method: "PATCH",
        body: {
          ...values,
          year: Number(values.year),
          rating: values.rating ? Number(values.rating) : null,
          durationMin: values.durationMin ? Number(values.durationMin) : null,
        },
      });
      setTitle((current) => current ? { ...current, ...result.data } : result.data);
      setMessage(result.data.revalidated === false
        ? "Saved, but the live title cache could not be refreshed."
        : "Title saved.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function setPublished(published: boolean) {
    setError(null);
    setMessage(null);
    try {
      const result = await blockbustersRequest<{ data: Title; revalidated: boolean }>(
        `titles/${params.id}/${published ? "publish" : "unpublish"}`,
        { write: true, method: "POST", body: { reason } },
      );
      setTitle((current) => current ? { ...current, ...result.data } : result.data);
      setMessage(result.revalidated ? `Title ${published ? "published" : "unpublished"}.` : "Saved, but the live title cache could not be refreshed.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  async function uploadImage(kind: "poster" | "backdrop", file: File) {
    setError(null);
    setMessage(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
      const signed = await blockbustersRequest<{ data: { uploadUrl: string; key: string } }>(
        "images/presign",
        { write: true, method: "POST", body: { titleId: params.id, kind, contentType: file.type, size: file.size } },
      );
      await uploadFile(signed.data.uploadUrl, file);
      await blockbustersRequest(`titles/${params.id}`, {
        write: true,
        method: "PATCH",
        body: { [kind === "poster" ? "posterKey" : "backdropKey"]: signed.data.key },
      });
      await load();
      setMessage(`${kind === "poster" ? "Poster" : "Backdrop"} uploaded.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  async function deleteTitle() {
    setError(null);
    try {
      await blockbustersRequest(`titles/${params.id}`, {
        write: true,
        method: "DELETE",
        body: { confirmation, reason },
      });
      router.push("/blockbusters/titles");
    } catch (cause) {
      if (cause instanceof BlockbustersApiError && cause.reauthUrl) {
        router.push(cause.reauthUrl);
        return;
      }
      setError(getErrorMessage(cause));
    }
  }

  if (!title) {
    return <p className="text-sm text-muted-foreground">{error ?? "Loading title…"}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title.title}</h1>
          <p className="text-sm text-muted-foreground">{title.published ? "Published" : "Draft"}</p>
        </div>
        <Button render={<Link href={`/blockbusters/titles/${title.id}/video`} />} variant="outline">
          Manage video
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <form className="space-y-4 rounded-lg border p-5" onSubmit={save}>
        <label className="block space-y-2 text-sm font-medium">Title<Input value={values.title} onChange={(event) => updateValue("title", event.target.value)} required maxLength={200} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium">Slug<Input value={values.slug} onChange={(event) => updateValue("slug", event.target.value)} required /></label>
          <label className="block space-y-2 text-sm font-medium">Year<Input type="number" value={values.year} onChange={(event) => updateValue("year", event.target.value)} required /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-2 text-sm font-medium">Genre<Input value={values.genre} onChange={(event) => updateValue("genre", event.target.value)} required /></label>
          <label className="block space-y-2 text-sm font-medium">Type
            <select className="h-10 w-full rounded-md border bg-background px-3" value={values.type} onChange={(event) => updateValue("type", event.target.value)}>
              <option value="movie">Movie</option><option value="series">Series</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium">Rating<Input type="number" step="0.1" min={0} max={10} value={values.rating} onChange={(event) => updateValue("rating", event.target.value)} /></label>
        </div>
        <label className="block space-y-2 text-sm font-medium">Duration (minutes)<Input type="number" min={1} value={values.durationMin} onChange={(event) => updateValue("durationMin", event.target.value)} /></label>
        <label className="block space-y-2 text-sm font-medium">Description<textarea className="min-h-28 w-full rounded-md border bg-background p-3" value={values.description} onChange={(event) => updateValue("description", event.target.value)} maxLength={10000} /></label>
        <Button disabled={saving} type="submit">{saving ? "Saving…" : "Save title"}</Button>
      </form>

      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="font-semibold">Artwork</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">Poster (2:3)
            <Input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage("poster", file);
            }} />
          </label>
          <label className="space-y-2 text-sm">Backdrop (16:9)
            <Input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage("backdrop", file);
            }} />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="font-semibold">Publishing</h2>
        <label className="block space-y-2 text-sm">Reason for change<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={reason.trim().length < 3} onClick={() => void setPublished(!title.published)} type="button">
            {title.published ? "Unpublish" : "Publish"}
          </Button>
          <span className="self-center text-xs text-muted-foreground">Publishing requires a ready video.</span>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-destructive/40 p-5">
        <h2 className="font-semibold text-destructive">Delete title</h2>
        <p className="text-sm text-muted-foreground">This permanently deletes the title and its video files.</p>
        <label className="block space-y-2 text-sm">Type “{title.title}” to confirm<Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <label className="block space-y-2 text-sm">Reason<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label>
        <Button disabled={confirmation !== title.title || reason.trim().length < 3} onClick={() => void deleteTitle()} type="button" variant="destructive">Delete permanently</Button>
      </section>
    </div>
  );
}
