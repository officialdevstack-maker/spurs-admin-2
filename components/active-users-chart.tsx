import type { ChartPoint } from "@/lib/accounts-api";

export function ActiveUsersChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  }

  const max = Math.max(1, ...points.map((p) => p.activeUsers));

  return (
    <div>
      <div className="flex h-48 items-end gap-1">
        {points.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${point.activeUsers} active`}
            className="group flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{
                height: `${(point.activeUsers / max) * 100}%`,
                minHeight: point.activeUsers > 0 ? 2 : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
