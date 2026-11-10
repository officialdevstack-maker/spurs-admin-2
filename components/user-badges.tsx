import type { ApiUser } from "@/lib/accounts-api";

export function UserBadges({ user }: { user: ApiUser }) {
  const items = [
    user.suspendedAt && {
      label: "Suspended",
      className: "bg-destructive/10 text-destructive",
    },
    user.isAdmin && {
      label: "Admin",
      className: "bg-accent text-accent-foreground",
    },
    user.isVerified
      ? { label: "Verified", className: "bg-secondary text-secondary-foreground" }
      : { label: "Unverified", className: "bg-muted text-muted-foreground" },
  ].filter(Boolean) as { label: string; className: string }[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.className}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
