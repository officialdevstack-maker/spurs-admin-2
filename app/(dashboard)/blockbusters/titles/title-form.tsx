"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockbustersRequest, getErrorMessage } from "@/lib/blockbusters-api";

export default function TitleForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    const body = {
      title: String(values.get("title") ?? ""),
      year: Number(values.get("year")),
      genre: String(values.get("genre") ?? ""),
      type: String(values.get("type") ?? "movie"),
      rating: values.get("rating") ? Number(values.get("rating")) : null,
      description: String(values.get("description") ?? ""),
    };
    try {
      const result = await blockbustersRequest<{ data: { id: string } }>("titles", {
        write: true,
        method: "POST",
        body,
      });
      router.push(`/blockbusters/titles/${result.data.id}`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New title</h1>
        <p className="text-sm text-muted-foreground">New titles start unpublished. Add artwork and video from the title page.</p>
      </div>
      <form className="space-y-4 rounded-lg border p-5" onSubmit={submit}>
        <label className="block space-y-2 text-sm font-medium">Title<Input name="title" required maxLength={200} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium">Year<Input name="year" type="number" min={1880} max={2200} required /></label>
          <label className="block space-y-2 text-sm font-medium">Genre<Input name="genre" required maxLength={80} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium">Type
            <select className="h-10 w-full rounded-md border bg-background px-3" name="type">
              <option value="movie">Movie</option>
              <option value="series">Series</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium">Rating (0–10)<Input name="rating" type="number" min={0} max={10} step="0.1" /></label>
        </div>
        <label className="block space-y-2 text-sm font-medium">Description<textarea className="min-h-28 w-full rounded-md border bg-background p-3" name="description" maxLength={10000} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={saving} type="submit">{saving ? "Creating…" : "Create draft"}</Button>
      </form>
    </div>
  );
}
