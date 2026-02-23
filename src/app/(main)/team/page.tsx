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

export default function TeamPage() {
  const { isLoading, user } = useUser();
  const [teamMembers, setTeamMembers] = useState<ProfileWithEmail[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [enrollmentInvite, setEnrollmentInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "tenant_admin" | "solicitor" | "paralegal"
  >("paralegal");
  const [createError, setCreateError] = useState("");
  const inviteFormMethods = useForm();

  const supabase = getSupabaseClient();

  // Check permissions - only tenant_admin and solicitor can access this page
  const canManageTeam =
    user?.role === "tenant_admin" || user?.role === "solicitor";

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

        if (existingEnrollment) {
          setEnrollmentInvite(existingEnrollment);
        } else {
          // Create a new anonymous invite for paralegals
          const { data: newInvite } = await supabase
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

          if (newInvite) {
            setEnrollmentInvite(newInvite);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch team data:", error);
      alert(
        error instanceof Error ? error.message : "Failed to load team data",
      );
    } finally {
      setLoading(false);
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

    if (!canManageTeam) {
      setCreateError("You don't have permission to invite team members");
      return;
    }

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
      alert("Enrollment code regenerated successfully!");

      // Refresh the full invite list
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

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  if (!canManageTeam) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Team</h1>
          <p className="mt-2 text-muted-foreground">
            You don't have permission to manage the team.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact your administrator for team management.
            </p>
          </CardContent>
        </Card>
      </section>
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

      {/* Enrollment Code Card (tenant_admin only) */}
      {user?.role === "tenant_admin" && enrollmentInvite && (
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
                <p className="text-xs text-muted-foreground mb-2">
                  Enrollment Code
                </p>
                <p className="text-4xl font-mono font-bold tracking-wider text-primary">
                  {enrollmentInvite.token}
                </p>
              </div>
              <AsyncButton
                variant="outline"
                onClick={handleRegenerateEnrollmentCode}
                pendingText="Regenerating..."
              >
                Regenerate Code
              </AsyncButton>
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
          <TabsTrigger value="invites">
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
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {member.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </TableCell>
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
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="member@example.com"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(
                            value: "tenant_admin" | "solicitor" | "paralegal",
                          ) => setInviteRole(value)}
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
                    {createError && (
                      <p className="text-sm text-destructive-foreground">
                        {createError}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Invite Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((invite) => {
                        const isExpired =
                          new Date(invite.expires_at) < new Date();
                        const isAccepted = !!invite.accepted_at;

                        return (
                          <TableRow key={invite.id}>
                            <TableCell>{invite.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {invite.role.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                {invite.token}
                              </code>
                            </TableCell>
                            <TableCell>
                              {isAccepted ? (
                                <Badge variant="default">Accepted</Badge>
                              ) : isExpired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(invite.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isAccepted && !isExpired && (
                                <div className="flex justify-end gap-2">
                                  <AsyncButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleResendInvite(invite.id)
                                    }
                                    pendingText="Resending..."
                                  >
                                    Resend
                                  </AsyncButton>
                                  <AsyncButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleRevokeInvite(invite.id)
                                    }
                                    pendingText="Revoking..."
                                  >
                                    Revoke
                                  </AsyncButton>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
