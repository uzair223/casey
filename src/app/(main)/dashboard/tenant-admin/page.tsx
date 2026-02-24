"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/contexts/UserContext";
import { TenantStats, getTenantStats } from "@/lib/supabase/queries/admin";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TenantAdminDashboard() {
  const { isLoading, user } = useUser("tenant_admin");
  const [stats, setStats] = useState<TenantStats | null>(null);

  const fetchData = async () => {
    if (!user?.tenant_id) return;

    try {
      const statsData = await getTenantStats(user.tenant_id);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      fetchData();
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          Tenant Admin
        </p>
        <h1 className="text-3xl font-semibold text-primary">Firm Management</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your team members and monitor case activity.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {stats && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2!">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Cases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.cases}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.recentActivity.cases} in last 7 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2!">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Statements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.statements}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.recentActivity.statements} in last 7 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2!">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Team Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {stats.teamMembers}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.pendingInvites} pending invites
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2!">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Link href="/cases">View Cases</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Link href="/team">Manage Team</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cases by Status */}
              {stats.casesByStatus &&
                Object.keys(stats.casesByStatus).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Cases by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {Object.entries(stats.casesByStatus).map(
                          ([status, count]) => (
                            <div key={status} className="flex flex-col">
                              <span className="text-sm text-muted-foreground capitalize">
                                {status}
                              </span>
                              <span className="text-2xl font-bold">
                                {count}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
