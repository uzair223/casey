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
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ProfileWithEmail } from "@/lib/supabase/queries/team";
import { generateAlphanumericCode } from "@/lib/security";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Invite } from "@/lib/types";
import InvitesTable from "@/components/InvitesTable";
import { apiFetch } from "@/lib/utils";

export default function TeamPage() {
  const { isLoading: isUserLoading, user } = useUser();
  const [isLoading, setIsLoading] = useState(true);

  const [teamMembers, setTeamMembers] = useState<ProfileWithEmail[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [enrollmentInvite, setEnrollmentInvite] = useState<Invite | null>(null);

  const inviteFormMethods = useForm<{ email: string; role: string }>({
    defaultValues: { email: "", role: "paralegal" },
  });
  const supabase = getSupabaseClient();

  // Check permissions - only tenant_admin and solicitor can access this page
  const canManageTeam =
    user?.role === "tenant_admin" || user?.role === "solicitor";

  const fetchData = async () => {
    if (!user?.tenant_id) return;

    try {
      const [membersData, invitesData] = await Promise.all([
        apiFetch<{ members: ProfileWithEmail[] }>("/api/team/members"),
        supabase
          .from("invites")
          .select("*")
          .eq("tenant_id", user.tenant_id)
          .order("created_at", { ascending: false }),
      ]);

      setTeamMembers(membersData.members);
      setInvites(invitesData.data || []);

      // For tenant admins, get or create an anonymous enrollment invite
      if (user.role === "tenant_admin") {
        // Find existing anonymous paralegal invite
        const existingEnrollment = invitesData.data?.find(
          (invite) =>
            invite.email === null &&
            invite.role === "paralegal" &&
            !invite.accepted_at,
        );
        setEnrollmentInvite(existingEnrollment || null);
      }
    } catch (error) {
      console.error("Failed to fetch team data:", error);
      alert(
        error instanceof Error ? error.message : "Failed to load team data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && user) {
      fetchData();
    }
  }, [isUserLoading, user]);

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
      await apiFetch("/api/team/invites", {
        method: "POST",
        body: JSON.stringify({ email: data.email, role: data.role }),
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
    if (!canManageTeam) {
      alert("You don't have permission to revoke invites");
      return;
    }

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
    if (!canManageTeam) {
      alert("You don't have permission to resend invites");
      return;
    }

    try {
      await apiFetch("/api/team/invites", {
        method: "PUT",
        body: JSON.stringify({ inviteId }),
      });
      fetchData();
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
  const handleRegenerateEnrollmentCode = async () => {
    if (!user?.tenant_id || user.role !== "tenant_admin") {
      alert("Only tenant admins can regenerate the enrollment code");
      return;
    }

    if (
      enrollmentInvite &&
      !confirm(
        "Are you sure you want to regenerate the enrollment code? The old code will stop working.",
      )
    )
      return;

    try {
      // Delete the old enrollment invite if it exists
      if (enrollmentInvite) {
        await supabase.from("invites").delete().eq("id", enrollmentInvite.id);
      }

      // Create a new anonymous invite for paralegals
      const { data: newInvite, error } = await supabase
        .from("invites")
        .insert({
          tenant_id: user.tenant_id,
          role: "paralegal",
          email: null, // Anonymous invite
          token: generateAlphanumericCode(8),
          created_by: user.id,
          expires_at: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 1 year expiry
        })
        .select()
        .single();

      if (error) throw error;

      setEnrollmentInvite(newInvite);
      fetchData();
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
      await apiFetch("/api/team/members", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

  if (isUserLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          {user?.role?.replace("_", " ")}
        </p>
        <h1 className="text-3xl font-semibold text-primary">Team Management</h1>
        <p className="mt-2 text-muted-foreground">
          Manage team members and send invitations.
        </p>
      </div>

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
              <div className="flex-1 bg-muted p-6 rounded-lg text-center">
                {enrollmentInvite ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Enrollment Code
                    </p>
                    <p className="text-4xl font-mono font-bold tracking-wider text-primary">
                      {enrollmentInvite.token}
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
              {enrollmentInvite && (
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
                    onClick={() => handleRevokeInvite(enrollmentInvite.id)}
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
            Members ({teamMembers.length})
          </TabsTrigger>
          <TabsTrigger value="invites" disabled={!canManageTeam}>
            Invites ({invites.filter((i) => !i.accepted_at).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {teamMembers.length === 0 ? (
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
                    {teamMembers.map((member) => (
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
                          value={inviteFormMethods.watch("role")}
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
                {invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No invites created yet.
                  </p>
                ) : (
                  <InvitesTable
                    invites={invites}
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
