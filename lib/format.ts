export function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export function formatDateTime(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";

  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "—";

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
