'use client'
import DefaultStatsCard from "@/components/default-stats-card";
import { listUsers } from "@/lib/accounts-api";
import { listAccountsOidcClients, listAdmins } from "@/lib/admin-api";
import { useEffect, useState } from "react";

export default  function DashboardPage() {
  const [data, setData] = useState<Record<string, number>>({ totalAdminUsers: 0, totalOidcUsers: 0, totalUsers: 0 })

  useEffect( () => {
    try {
      Promise.all([
        listAccountsOidcClients(),
        listUsers(),
        listAdmins(),

      ])
      .then(([res1, res2, res3]) => {
        return [
          res1?.length || 0,
          res2?.data?.length || 0,
          res3?.data?.length || 0
        ]
      })
      .then(([totalOidcUsers, totalUsers, totalAdminUsers]) => {
        setData({
          totalUsers,
          totalAdminUsers,
          totalOidcUsers,
        })
      })
    } catch{

    }
    return;
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of every subdomain you manage.</p>
      </div>

      <div className="container">
        <DefaultStatsCard {...data as any} />
      </div>
    </div>
  );
}
