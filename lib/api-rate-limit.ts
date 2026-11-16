const requestHits = new Map<string, { count: number; resetAt: number }>();

export function isApiRateLimited(
  keyId: number,
  limit: number,
  windowMs: number,
  scope = "default",
): boolean {
  const now = Date.now();
  const bucket = `${scope}:${keyId}`;
  const entry = requestHits.get(bucket);
  if (!entry || entry.resetAt <= now) {
    requestHits.set(bucket, { count: 1, resetAt: now + windowMs });
    if (requestHits.size > 10_000) {
      for (const [id, hit] of requestHits) {
        if (hit.resetAt <= now) requestHits.delete(id);
      }
    }
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}
