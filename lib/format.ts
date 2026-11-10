export function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export function formatDateTime(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : "—";
}
