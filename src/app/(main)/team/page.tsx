"use client";

import {
  useForm,
  FormProvider,
  SubmitHandler,
  useWatch,
} from "react-hook-form";
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
import { ProfileWithEmail } from "@/lib/supabase/queries/team";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import InvitesTable from "@/components/InvitesTable";
import { apiFetch } from "@/lib/utils";
import { useAsync } from "@/hooks/useAsync";
import {
  createInvite,
  getInvites,
  resendInvite,
  revokeInvite,
} from "@/lib/supabase/queries";
import { PageTitle } from "@/components/PageTitle";

export default function TeamPage() {
  const { isLoading: isUserLoading, user } = useUser();

  const inviteFormMethods = useForm<{ email: string; role: string }>({
    defaultValues: { email: "", role: "paralegal" },
  });

  const canManageTeam = ["tenant_admin", "solicitor"].includes(
    user?.role || "",
  );
  const selectedInviteRole = useWatch({
    control: inviteFormMethods.control,
    name: "role",
  });

  const {
    data,
    isLoading: isDataLoading,
    handler,
  } = useAsync(
    async () => {
      if (!user || !user?.tenant_id) return;

      const [{ members: teamMembers }, invites] = await Promise.all([
        apiFetch<{ members: ProfileWithEmail[] }>("/api/tenant/members"),
        getInvites(),
      ]);

      const enrollmentInvite =
        user.role === "tenant_admin"
          ? invites.find(
              (invite) =>
                invite.email === null &&
                invite.role === "paralegal" &&
                !invite.accepted_at,
            )
          : null;

      return { teamMembers, invites, enrollmentInvite };
    },
    [user],
    { enabled: !!user?.tenant_id },
  );

  if (!data || isUserLoading || isDataLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  const handleCreateInvite: SubmitHandler<{
    email: string;
    role: string;
  }> = async (data) => {
    if (!canManageTeam) {
      inviteFormMethods.setError("email", {
        message: "You don't have permission to create invites",
      });
      return;
    }
    try {
      const { email, token } = await createInvite(
        data.email,
        data.role,
        user!.tenant_id,
        user!.id,
      );
      if (email) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email, token }),
        });
      }
      handler();
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
    if (!canManageTeam) {
      alert("You don't have permission to revoke invites");
      return;
    }

    if (!confirm("Are you sure you want to revoke this invite?")) return;

    try {
      await revokeInvite(inviteId);
      handler();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to revoke invite");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!canManageTeam) {
      alert("You don't have permission to resend invites");
      return;
    }

    try {
      const { email, token } = await resendInvite(inviteId);
      if (email) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email, token }),
        });
      }
      handler();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to resend invite");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!canManageTeam) {
      alert("You don't have permission to update user roles");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to update this user's role to ${newRole}?`,
      )
    )
      return;

    try {
      await apiFetch("/api/tenant/members", {
        method: "PUT",
        body: JSON.stringify({ userId, role: newRole }),
      });
      handler();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to update user role",
      );
    }
  };
  const handleRegenerateEnrollmentCode = async () => {
    if (!user?.tenant_id || user.role !== "tenant_admin") {
      alert("Only tenant admins can regenerate the enrollment code");
      return;
    }

    if (
      data.enrollmentInvite &&
      !confirm(
        "Are you sure you want to regenerate the enrollment code? The old code will stop working.",
      )
    )
      return;

    try {
      // Delete the old enrollment invite if it exists
      if (data.enrollmentInvite) {
        await revokeInvite(data.enrollmentInvite.id);
      }

      // Create a new anonymous invite for paralegals
      await createInvite(null, "paralegal", user.tenant_id, user.id, 365);
      await handler();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to regenerate enrollment code",
      );
    }
  };
  const handleRemoveMember = async (userId: string) => {
    if (!canManageTeam) {
      alert("You don't have permission to remove team members");
      return;
    }

    if (!confirm("Are you sure you want to remove this user from your team?"))
      return;

    try {
      await apiFetch("/api/tenant/members", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      handler();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

  return (
    <section className="space-y-6">
      <PageTitle
        subtitle={user?.tenant_name}
        title="Team Management"
        description="Manage your organization's team members and invites."
      />
      {canManageTeam && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Enrollment Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this code with new paralegals to join your organization.
              Anyone with this code can create an account and automatically join
              as a paralegal.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-muted p-4 rounded-lg text-center">
                {data.enrollmentInvite ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Enrollment Code
                    </p>
                    <p className="text-4xl font-mono font-bold tracking-wider text-primary">
                      {data.enrollmentInvite.token}
                    </p>
                  </>
                ) : (
                  <AsyncButton
                    variant="outline"
                    onClick={handleRegenerateEnrollmentCode}
                    pendingText="Regenerating..."
                  >
                    Generate Code
                  </AsyncButton>
                )}
              </div>
              {!!data.enrollmentInvite && (
                <div className="flex flex-col gap-2">
                  <AsyncButton
                    variant="outline"
                    onClick={handleRegenerateEnrollmentCode}
                    pendingText="Regenerating..."
                  >
                    Regenerate
                  </AsyncButton>
                  <AsyncButton
                    variant="outline"
                    onClick={() =>
                      handleRevokeInvite(data.enrollmentInvite!.id)
                    }
                    pendingText="Revoking..."
                  >
                    Revoke
                  </AsyncButton>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              💡 New users can use this code during sign-up instead of waiting
              for an email invite.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">
            Members ({data.teamMembers.length})
          </TabsTrigger>
          <TabsTrigger value="invites" disabled={!canManageTeam}>
            Invites ({data.invites.filter((i) => !i.accepted_at).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {data.teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No team members yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.teamMembers.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell>{member.display_name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {member.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </TableCell>
                        {canManageTeam && (
                          <TableCell className="text-right">
                            {member.user_id !== user?.id && (
                              <div className="flex justify-end gap-2">
                                <Select
                                  value={member.role}
                                  onValueChange={(newRole) =>
                                    handleUpdateRole(member.user_id, newRole)
                                  }
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="tenant_admin">
                                      Tenant Admin
                                    </SelectItem>
                                    <SelectItem value="solicitor">
                                      Solicitor
                                    </SelectItem>
                                    <SelectItem value="paralegal">
                                      Paralegal
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <AsyncButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveMember(member.user_id)
                                  }
                                  pendingText="Removing..."
                                >
                                  Remove
                                </AsyncButton>
                              </div>
                            )}
                            {member.user_id === user?.id && (
                              <span className="text-sm text-muted-foreground">
                                You
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Invite</CardTitle>
              </CardHeader>
              <CardContent>
                <FormProvider {...inviteFormMethods}>
                  <form
                    onSubmit={inviteFormMethods.handleSubmit(
                      handleCreateInvite,
                    )}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          type="email"
                          placeholder="member@example.com"
                          required
                          {...inviteFormMethods.register("email")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={selectedInviteRole}
                          onValueChange={(value) =>
                            inviteFormMethods.setValue("role", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tenant_admin">
                              Tenant Admin
                            </SelectItem>
                            <SelectItem value="solicitor">Solicitor</SelectItem>
                            <SelectItem value="paralegal">Paralegal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {inviteFormMethods.formState.errors.email && (
                      <p className="text-sm text-destructive-foreground">
                        {inviteFormMethods.formState.errors.email.message?.toString()}
                      </p>
                    )}
                    <AsyncButton type="submit" pendingText="Creating...">
                      Create Invite
                    </AsyncButton>
                  </form>
                </FormProvider>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Invites</CardTitle>
              </CardHeader>
              <CardContent>
                {data.invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No invites created yet.
                  </p>
                ) : (
                  <InvitesTable
                    invites={data.invites}
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
