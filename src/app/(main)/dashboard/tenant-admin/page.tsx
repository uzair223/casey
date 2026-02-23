"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import { TenantStats, getTenantStats } from "@/lib/supabase/queries/admin";
import { ProfileWithEmail } from "@/lib/supabase/queries/team";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Invite } from "@/lib/types";

export default function TenantAdminDashboard() {
  const { isLoading, user } = useUser("tenant_admin");
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [teamMembers, setTeamMembers] = useState<ProfileWithEmail[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "tenant_admin" | "solicitor" | "paralegal"
  >("paralegal");
  const [createError, setCreateError] = useState("");
  const inviteFormMethods = useForm();

  const supabase = getSupabaseClient();

  const getAccessToken = async () => {
    if (!supabase) {
      throw new Error("Supabase client not available");
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("User not authenticated");
    }

    return data.session.access_token;
  };

  const apiFetch = async <T,>(
    url: string,
    options?: RequestInit,
  ): Promise<T> => {
    const token = await getAccessToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  };

  const fetchData = async () => {
    if (!user?.tenant_id) return;

    try {
      const [statsData, membersData, invitesData] = await Promise.all([
        getTenantStats(user.tenant_id),
        apiFetch<{ members: ProfileWithEmail[] }>("/api/team/members"),
        supabase
          .from("invites")
          .select("*")
          .eq("tenant_id", user.tenant_id)
          .order("created_at", { ascending: false }),
      ]);

      setStats(statsData);
      setTeamMembers(membersData.members);
      setInvites(invitesData.data || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      fetchData();
    }
  }, [isLoading, user]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    try {
      const result = await apiFetch<{ emailSent?: boolean }>(
        "/api/team/invites",
        {
          method: "POST",
          body: JSON.stringify({ email, role: inviteRole }),
        },
      );

      if (result.emailSent === false) {
        setCreateError(
          "Invite created, but the email could not be sent. Please resend.",
        );
      }

      setEmail("");
      fetchData();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create invite";
      setCreateError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return;

    try {
      await apiFetch("/api/team/invites", {
        method: "DELETE",
        body: JSON.stringify({ inviteId }),
      });
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to revoke invite");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const result = await apiFetch<{ emailSent?: boolean }>(
        "/api/team/invites",
        {
          method: "PUT",
          body: JSON.stringify({ inviteId }),
        },
      );
      fetchData();
      if (result.emailSent === false) {
        alert("Invite updated, but the email could not be sent.");
      } else {
        alert("Invite resent successfully! Expiry date extended by 7 days.");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to resend invite");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (
      !confirm(
        `Are you sure you want to update this user's role to ${newRole}?`,
      )
    )
      return;

    try {
      await apiFetch("/api/team/members", {
        method: "PUT",
        body: JSON.stringify({ userId, role: newRole }),
      });
      fetchData();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to update user role",
      );
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user from your team?"))
      return;

    try {
      await apiFetch("/api/team/members", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

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
