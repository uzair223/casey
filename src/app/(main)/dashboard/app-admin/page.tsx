"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
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
import { useUser } from "@/contexts/UserContext";
import {
  PlatformStats,
  TenantWithCounts,
  AppAdminMember,
  getPlatformStats,
  getTenantsWithCounts,
  getTenantSignupInvites,
  getAppAdminInvites,
  getAppAdminMembers,
} from "@/lib/supabase/queries/admin";
import { Invite } from "@/lib/types";
import InvitesTable from "@/components/InvitesTable";
import { apiFetch } from "@/lib/utils";

export default function AppAdminDashboard() {
  const { isLoading, user } = useUser("app_admin");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenantInvites, setTenantInvites] = useState<Invite[]>([]);
  const [appAdminInvites, setAppAdminInvites] = useState<Invite[]>([]);
  const [appAdminMembers, setAppAdminMembers] = useState<AppAdminMember[]>([]);
  const [tenants, setTenants] = useState<TenantWithCounts[]>([]);

  const inviteFormMethods = useForm<{ email: string }>();

  const fetchData = async () => {
    try {
      const [
        statsData,
        tenantsData,
        tenantInvitesData,
        adminInvitesData,
        appAdminMembersData,
      ] = await Promise.all([
        getPlatformStats(),
        getTenantsWithCounts(),
        getTenantSignupInvites(),
        getAppAdminInvites(),
        getAppAdminMembers(),
      ]);

      setStats(statsData);
      setTenants(tenantsData);
      setTenantInvites(tenantInvitesData);
      setAppAdminInvites(adminInvitesData);
      setAppAdminMembers(appAdminMembersData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      fetchData();
    }
  }, [isLoading, user]);

  const handleCreateInvite =
    (role: string): SubmitHandler<{ email: string }> =>
    async (data) => {
      inviteFormMethods.clearErrors("email");

      try {
        await apiFetch("/api/admin/invites", {
          method: "POST",
          body: JSON.stringify({
            email: data.email,
            role,
          }),
        });
        fetchData();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create invite";
        inviteFormMethods.setError("email", {
          message: errorMessage,
        });
        throw new Error(errorMessage);
      }
    };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return;

    try {
      await apiFetch("/api/admin/invites", {
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
      await apiFetch("/api/admin/invites", {
        method: "PUT",
        body: JSON.stringify({ inviteId }),
      });
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to resend invite");
    }
  };

  const handleRevokeTenantAccess = async (
    tenantId: string,
    tenantName: string,
  ) => {
    if (
      !confirm(
        `Revoke all access for ${tenantName}? This removes all tenant member access and pending invites.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch("/api/admin/tenants", {
        method: "DELETE",
        body: JSON.stringify({ tenantId }),
      });
      fetchData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to revoke tenant access",
      );
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
          App Admin
        </p>
        <h1 className="text-3xl font-semibold text-primary">
          Platform Management
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage tenant onboarding and monitor platform activity.
        </p>
      </div>

      <Tabs className="space-y-2" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="app_admin">App Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {stats && (
            <div>
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2!">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tenants
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.tenants}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2!">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Cases
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
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.users}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.pendingInvites} pending invites
                    </p>
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

        <TabsContent value="tenants">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invite New Tenant</CardTitle>
              </CardHeader>
              <CardContent>
                <FormProvider {...inviteFormMethods}>
                  <form
                    onSubmit={inviteFormMethods.handleSubmit(
                      handleCreateInvite("tenant_admin"),
                    )}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="tenant-invite-email">Email</Label>
                      <Input
                        type="email"
                        placeholder="tenant.admin@example.com"
                        required
                        {...inviteFormMethods.register("email")}
                      />
                    </div>
                    {inviteFormMethods.formState.errors.email && (
                      <p className="text-sm text-destructive-foreground">
                        {inviteFormMethods.formState.errors.email.message}
                      </p>
                    )}
                    <AsyncButton type="submit" pendingText="Creating...">
                      Create Tenant Invite
                    </AsyncButton>
                  </form>
                </FormProvider>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Tenants</CardTitle>
              </CardHeader>
              <CardContent>
                {tenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tenants found.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Cases</TableHead>
                        <TableHead>Statements</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell>{tenant.name}</TableCell>
                          <TableCell>{tenant.userCount}</TableCell>
                          <TableCell>{tenant.caseCount}</TableCell>
                          <TableCell>{tenant.statementCount}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(tenant.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <AsyncButton
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRevokeTenantAccess(tenant.id, tenant.name)
                              }
                              pendingText="Revoking..."
                            >
                              Revoke Access
                            </AsyncButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tenant Invites</CardTitle>
              </CardHeader>
              <CardContent>
                {tenantInvites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tenant invites created yet.
                  </p>
                ) : (
                  <InvitesTable
                    invites={tenantInvites}
                    onResendInvite={handleResendInvite}
                    onRevokeInvite={handleRevokeInvite}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="app_admin">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>App Admin Team</CardTitle>
              </CardHeader>
              <CardContent>
                {appAdminMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No app admins found.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appAdminMembers.map((member) => (
                        <TableRow key={member.user_id}>
                          <TableCell>{member.display_name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {member.user_id}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invite App Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <FormProvider {...inviteFormMethods}>
                  <form
                    onSubmit={inviteFormMethods.handleSubmit(
                      handleCreateInvite("app_admin"),
                    )}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        required
                        {...inviteFormMethods.register("email")}
                      />
                    </div>
                    {inviteFormMethods.formState.errors.email && (
                      <p className="text-sm text-destructive-foreground">
                        {inviteFormMethods.formState.errors.email.message}
                      </p>
                    )}
                    <AsyncButton type="submit" pendingText="Creating...">
                      Create App Admin Invite
                    </AsyncButton>
                  </form>
                </FormProvider>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>App Admin Invites</CardTitle>
              </CardHeader>
              <CardContent>
                {appAdminInvites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No app admin invites created yet.
                  </p>
                ) : (
                  <InvitesTable
                    invites={appAdminInvites}
                    onResendInvite={handleResendInvite}
                    onRevokeInvite={handleRevokeInvite}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
