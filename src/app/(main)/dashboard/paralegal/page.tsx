"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { getStatements } from "@/lib/supabase/queries";
import { StatementCard } from "@/components/statements";
import Link from "next/link";
import { AsyncButton } from "@/components/ui/async-button";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/utils";
import { ProfileWithEmail } from "@/lib/supabase/queries/team";
import { PageTitle } from "@/components/PageTitle";

export default function ParalegalDashboard() {
  const { isLoading: isUserLoading, user } = useUser("paralegal");

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

  const { data: members } = useAsync(
    async () => {
      if (!user?.tenant_id) return [] as ProfileWithEmail[];
      const response = await apiFetch<{ members: ProfileWithEmail[] }>(
        "/api/tenant/members",
      );
      return response.members;
    },
    [user?.tenant_id],
    { enabled: !!user?.tenant_id },
  );

  const assigneeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of members || []) {
      map[member.user_id] =
        member.display_name || member.email || "Team member";
    }
    return map;
  }, [members]);

  if (!statements || isUserLoading || isDataLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const assignedStatements = statements.filter((statement) => {
    if (!user?.id) return false;
    return (
      statement.assigned_to === user.id ||
      (statement.assigned_to_ids || []).includes(user.id)
    );
  });

  const filterByStatus: Record<string, number> = assignedStatements.reduce(
    (acc, caseItem) => {
      const statusKey = caseItem.status || "draft";
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recent = assignedStatements.slice(0, 10); // Show 10 most recent

  return (
    <section className="space-y-6">
      <PageTitle
        subtitle={user?.tenant_name}
        title="Paralegal Dashboard"
        description="Manage your assigned cases and collect witness statements."
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {assignedStatements.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filterByStatus.draft || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collecting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filterByStatus.in_progress || 0}
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
      {Object.keys(filterByStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cases by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(filterByStatus).map(([status, count]) => (
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
            <CardTitle>My Cases</CardTitle>
            <Link href="/cases">
              <AsyncButton variant="ghost" size="sm">
                View All
              </AsyncButton>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No cases assigned to you yet.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact your administrator to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recent.map((item) => (
                <StatementCard
                  key={item.id}
                  item={item}
                  fetchData={fetchData}
                  assigneeLabelMap={assigneeLabelMap}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
