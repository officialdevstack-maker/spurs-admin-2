import { ExternalLink } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBDOMAINS, subdomainUrl } from "@/lib/subdomains";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of every subdomain you manage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUBDOMAINS.map((s) => (
          <a key={s.slug} href={subdomainUrl(s.slug)} target="_blank" rel="noopener noreferrer">
            <Card className="rounded-2xl ring-0 transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
                      {s.name.slice(0, 1)}
                    </span>
                    {s.name}
                  </span>
                  <ExternalLink className="size-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{subdomainUrl(s.slug)}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
