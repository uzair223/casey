"use client";

import {
  useForm,
  FormProvider,
  SubmitHandler,
  useWatch,
} from "react-hook-form";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  getPlatformStats,
  getTenantsWithCounts,
  getTenantSignupInvites,
  getAppAdminInvites,
  getAppAdminMembers,
  getWaitlistSignups,
} from "@/lib/supabase/queries/admin";
import InvitesTable from "@/components/InvitesTable";
import { apiFetch, getRoleLabel } from "@/lib/utils";
import { useAsync } from "@/hooks/useAsync";
import {
  createInvite,
  resendInvite,
  revokeInvite,
} from "@/lib/supabase/queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTitle } from "@/components/PageTitle";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function AppAdminDashboard() {
  const { isLoading: isUserLoading, user } = useUser("app_admin");

  const inviteFormMethods = useForm<{ email: string; role: string }>({
    defaultValues: {
      email: "",
      role: "tenant_admin",
    },
  });
  const selectedRole = useWatch({
    control: inviteFormMethods.control,
    name: "role",
  });

  const {
    data,
    isLoading: isDataLoading,
    handler: fetchData,
  } = useAsync(
    async () => {
      return {
        stats: await getPlatformStats(),
        tenants: await getTenantsWithCounts(),
        tenantInvites: await getTenantSignupInvites(),
        appAdminInvites: await getAppAdminInvites(),
        appAdminMembers: await getAppAdminMembers(),
        waitlistSignups: await getWaitlistSignups(),
      };
    },
    [user],
    { enabled: !!user },
  );

  const handleCreateInvite: SubmitHandler<{
    email: string;
    role: string;
  }> = async (data) => {
    inviteFormMethods.clearErrors("email");

    try {
      const { email, token } = await createInvite(
        data.email,
        data.role,
        null,
        user!.id,
      );
      if (email) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email, token }),
        });
      }
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
      await revokeInvite(inviteId);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to revoke invite");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const { email, token } = await resendInvite(inviteId);
      if (email) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email, token }),
        });
      }
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

  const handleInviteWaitlist = async (waitlistId: string, email: string) => {
    try {
      const { email: inviteEmail, token } = await createInvite(
        email,
        "tenant_admin",
        null,
        user!.id,
      );

      if (inviteEmail) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email: inviteEmail, token }),
        });
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("waitlist_signups")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", waitlistId);

      if (error) {
        throw error;
      }

      fetchData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to send invite to waitlist signup",
      );
    }
  };

  if (!data || isDataLoading || isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const inviteMemberForm = (
    <Card>
      <CardHeader>
        <CardTitle>Invite Member</CardTitle>
      </CardHeader>
      <FormProvider {...inviteFormMethods}>
        <form onSubmit={inviteFormMethods.handleSubmit(handleCreateInvite)}>
          <CardContent className="flex items-end gap-2 max-w-2xl">
            <div className="form-item flex-1">
              <Input
                type="email"
                placeholder="admin@example.com"
                required
                {...inviteFormMethods.register("email")}
              />
              <Label htmlFor="tenant-invite-email">Email</Label>
            </div>
            <div className="form-item w-48">
              <Select
                value={selectedRole}
                onValueChange={(v) => inviteFormMethods.setValue("role", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  <SelectItem value="app_admin">App Admin</SelectItem>
                </SelectContent>
              </Select>
              <Label htmlFor="tenant-invite-role">Role</Label>
            </div>
            <AsyncButton type="submit" pendingText="Creating...">
              Create Invite
            </AsyncButton>
          </CardContent>
          {inviteFormMethods.formState.errors.email && (
            <CardFooter>
              <p className="text-sm text-destructive-foreground">
                {inviteFormMethods.formState.errors.email.message}
              </p>
            </CardFooter>
          )}
        </form>
      </FormProvider>
    </Card>
  );

  return (
    <section className="space-y-6">
      <PageTitle
        subtitle={getRoleLabel(user?.role)}
        title="Admin Dashboard"
        description="View platform statistics and manage tenants and app admins."
      />

      <Tabs className="space-y-2" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="app_admin">App Admin</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {data.stats && (
            <>
              {/* Stats Cards */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tenants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.stats.tenants}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Cases
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.stats.cases}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.stats.recentActivity.cases} in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Statements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {data.stats.statements}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.stats.recentActivity.statements} in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.stats.users}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.stats.pendingInvites} pending invites
                  </p>
                </CardContent>
              </Card>

              {/* Cases by Status */}
              {data.stats.casesByStatus &&
                Object.keys(data.stats.casesByStatus).length > 0 && (
                  <Card className="col-span-full">
                    <CardHeader>
                      <CardTitle>Cases by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {Object.entries(data.stats.casesByStatus).map(
                          ([status, count]) => (
                            <div key={status} className="flex flex-col">
                              <span className="text-sm text-muted-foreground capitalize">
                                {status.replace("_", " ")}
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
            </>
          )}
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          {inviteMemberForm}

          <Card>
            <CardHeader>
              <CardTitle>Existing Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tenants found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Statements</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>{tenant.name}</TableCell>
                        <TableCell>{tenant.userCount}</TableCell>
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
              {data.tenantInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tenant invites created yet.
                </p>
              ) : (
                <InvitesTable
                  invites={data.tenantInvites}
                  onResendInvite={handleResendInvite}
                  onRevokeInvite={handleRevokeInvite}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="app_admin" className="space-y-4">
          {inviteMemberForm}
          <Card>
            <CardHeader>
              <CardTitle>App Admin Team</CardTitle>
            </CardHeader>
            <CardContent>
              {data.appAdminMembers.length === 0 ? (
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
                    {data.appAdminMembers.map((member) => (
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
              <CardTitle>App Admin Invites</CardTitle>
            </CardHeader>
            <CardContent>
              {data.appAdminInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No app admin invites created yet.
                </p>
              ) : (
                <InvitesTable
                  invites={data.appAdminInvites}
                  onResendInvite={handleResendInvite}
                  onRevokeInvite={handleRevokeInvite}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Waitlist Signups</CardTitle>
            </CardHeader>
            <CardContent>
              {data.waitlistSignups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No waitlist signups yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.waitlistSignups.map((signup) => (
                      <TableRow key={signup.id}>
                        <TableCell>{signup.full_name}</TableCell>
                        <TableCell>{signup.company_name}</TableCell>
                        <TableCell>{signup.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(signup.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {signup.invited_at ? (
                            <Badge variant="secondary">Invited</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <AsyncButton
                            variant="ghost"
                            size="sm"
                            pendingText={
                              signup.invited_at ? "Resending..." : "Sending..."
                            }
                            onClick={() =>
                              handleInviteWaitlist(signup.id, signup.email)
                            }
                          >
                            {signup.invited_at ? "Resend Invite" : "Invite"}
                          </AsyncButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
