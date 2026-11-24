"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockbustersRequest, getErrorMessage } from "@/lib/blockbusters-api";

type Title = {
  id: string;
  title: string;
  year: number;
  genre: string;
  type: "movie" | "series";
  published: boolean;
  updatedAt: string;
};

export default function BlockbustersTitlesPage() {
  const [titles, setTitles] = React.useState<Title[]>([]);
  const [query, setQuery] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [type, setType] = React.useState("");
  const [published, setPublished] = React.useState("");
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (cursor?: string, append = false) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sort: "updated" });
    if (query.trim()) params.set("q", query.trim());
    if (genre.trim()) params.set("genre", genre.trim());
    if (type) params.set("type", type);
    if (published) params.set("published", published);
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await blockbustersRequest<{ data: Title[]; nextCursor: string | null }>(`titles?${params}`);
      setTitles((current) => append ? [...current, ...result.data] : result.data);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [genre, published, query, type]);

  React.useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ sort: "updated" });
    if (query.trim()) params.set("q", query.trim());
    if (genre.trim()) params.set("genre", genre.trim());
    if (type) params.set("type", type);
    if (published) params.set("published", published);
    blockbustersRequest<{ data: Title[]; nextCursor: string | null }>(`titles?${params}`)
      .then((result) => {
        if (!active) return;
        setTitles(result.data);
        setNextCursor(result.nextCursor);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [genre, published, query, type]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Titles</h1>
          <p className="text-sm text-muted-foreground">Search, edit and publish catalog titles.</p>
        </div>
        <Button render={<Link href="/blockbusters/titles/new" />}>
          <Plus className="size-4" />
          New title
        </Button>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_12rem_10rem_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <Input aria-label="Search titles" onChange={(event) => setQuery(event.target.value)} placeholder="Search title…" value={query} />
        <Input aria-label="Genre filter" onChange={(event) => setGenre(event.target.value)} placeholder="Genre" value={genre} />
        <select aria-label="Type filter" className="h-10 rounded-md border bg-background px-3 text-sm" onChange={(event) => setType(event.target.value)} value={type}>
          <option value="">All types</option>
          <option value="movie">Movie</option>
          <option value="series">Series</option>
        </select>
        <select aria-label="Publication filter" className="h-10 rounded-md border bg-background px-3 text-sm" onChange={(event) => setPublished(event.target.value)} value={published}>
          <option value="">All states</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
        <Button type="submit" variant="outline"><Search className="size-4" />Search</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Genre</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((title) => (
              <tr className="border-t" key={title.id}>
                <td className="px-4 py-3 font-medium">
                  <Link className="hover:text-primary" href={`/blockbusters/titles/${title.id}`}>{title.title}</Link>
                </td>
                <td className="px-4 py-3">{title.genre}</td>
                <td className="px-4 py-3 capitalize">{title.type}</td>
                <td className="px-4 py-3">{title.year}</td>
                <td className="px-4 py-3">{title.published ? "Published" : "Draft"}</td>
              </tr>
            ))}
            {!loading && titles.length === 0 && (
              <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={5}>No titles found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading titles…</p>}
      {nextCursor && (
        <Button disabled={loading} onClick={() => void load(nextCursor, true)} variant="outline">
          Load more
        </Button>
      )}
    </div>
  );
}
