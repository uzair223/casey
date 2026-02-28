"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { getStatements } from "@/lib/supabase/queries";
import { StatementCard } from "@/components/statements";
import Link from "next/link";
import { AsyncButton } from "@/components/ui/async-button";
import { useAsync } from "@/hooks/useAsync";

export default function SolicitorDashboard() {
  const { isLoading: isUserLoading, user } = useUser("solicitor");
  const {
    data: statements,
    isLoading: isDataLoading,
    handler: fetchData,
  } = useAsync(
    async () => {
      if (!user || !user?.tenant_id) return;
      return await getStatements();
    },
    [user],
    { enabled: !!user?.tenant_id },
  );

  if (!statements || isDataLoading || isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const countByStatus: Record<string, number> = statements.reduce(
    (acc, item) => {
      const statusKey = item.status || "draft";
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recentCases = statements.slice(0, 10); // Show 10 most recent

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          Solicitor
        </p>
        <h1 className="text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Manage and review witness statements for all cases.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statements.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{countByStatus.draft || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {countByStatus.submitted || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/cases">
              <AsyncButton variant="outline" size="sm" className="w-full">
                View All Cases
              </AsyncButton>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Cases by Status */}
      {Object.keys(countByStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cases by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(countByStatus).map(([status, count]) => (
                <div key={status} className="flex flex-col">
                  <span className="text-sm text-muted-foreground capitalize">
                    {status}
                  </span>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Cases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Cases</CardTitle>
            <Link href="/cases">
              <AsyncButton variant="ghost" size="sm">
                View All
              </AsyncButton>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cases found. Create a new case to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {recentCases.map((caseItem) => (
                <StatementCard
                  key={caseItem.id}
                  item={caseItem}
                  fetchData={fetchData}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
