"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import { CaseWithWitness, getCases } from "@/lib/supabase/queries/cases";
import { CaseCard } from "@/components/cases";
import Link from "next/link";
import { AsyncButton } from "@/components/ui/async-button";

export default function ParalegalDashboard() {
  const { isLoading, user } = useUser("paralegal");
  const [cases, setCases] = useState<CaseWithWitness[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseClient();

  useEffect(() => {
    const fetchCases = async () => {
      if (!user?.tenant_id) return;

      try {
        const casesData = await getCases(user.tenant_id, user.id, user.role);
        setCases(casesData);
      } catch (error) {
        console.error("Failed to fetch cases:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading && user) {
      fetchCases();
    }
  }, [isLoading, user]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const casesByStatus = cases.reduce(
    (acc, caseItem) => {
      const statusKey = caseItem.statement_status || "draft";
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recentCases = cases.slice(0, 10); // Show 10 most recent

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          Paralegal
        </p>
        <h1 className="text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your assigned cases and collect witness statements.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{cases.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{casesByStatus.draft || 0}</div>
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
              {casesByStatus.in_progress || 0}
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
      {Object.keys(casesByStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cases by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(casesByStatus).map(([status, count]) => (
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
          {recentCases.length === 0 ? (
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
              {recentCases.map((caseItem) => (
                <CaseCard
                  key={caseItem.id}
                  item={caseItem}
                  isEditing={false}
                  role={user?.role || null}
                  currentuser_id={user?.id || null}
                  teamMembers={[]}
                  editForm={{
                    title: "",
                    reference: "",
                    claimNumber: "",
                    witnessName: "",
                    witnessAddress: "",
                    witnessOccupation: "",
                    witnessEmail: "",
                    incidentDate: "",
                    status: "draft",
                    assignedTo: "",
                  }}
                  onEditFormChange={() => {}}
                  onStartEdit={() => {}}
                  onCancelEdit={() => {}}
                  onSave={async () => {}}
                  onDelete={async () => {}}
                  onSendStatementLink={async () => {}}
                  onRegenerateLink={async () => {}}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
