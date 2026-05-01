"use client";

import { useCallback, useEffect, useState } from "react";
import { InviteMemberCard } from "@/components/dashboard/shared/invite-member-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/contexts/tenant-context";
import { CardSkeleton } from "@/components/dashboard/shared/skeleton";
import { useCanManageTeam, useUser } from "@/contexts/user-context";
import { AsyncButton } from "@/components/ui/async-button";
import type { Invite, Profile } from "@/types";
import { getTenantParalegalInviteCode } from "@/lib/supabase/queries";
import { regenerateTenantParalegalInviteCode } from "@/lib/supabase/mutations";
import {
  removeTeamMember,
  restoreTeamMember,
} from "@/lib/supabase/mutations/team";
import { toast } from "@/lib/toast";

export function TenantRoleTeamTab() {
  const { user } = useUser();
  const { team } = useTenant();
  const canManageTeam = useCanManageTeam();
  const [teamInviteCode, setTeamInviteCode] = useState<Invite | null>(null);
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const [isInviteCodeLoading, setIsInviteCodeLoading] = useState(false);

  const loadTeamInviteCode = useCallback(async () => {
    if (!user?.tenant_id || !user.id) {
      setTeamInviteCode(null);
      return;
    }

    setIsInviteCodeLoading(true);
    setInviteCodeError(null);

    try {
      let invite = await getTenantParalegalInviteCode(user.tenant_id);
      if (!invite) {
        invite = await regenerateTenantParalegalInviteCode(
          user.tenant_id,
          user.id,
        );
      }

      setTeamInviteCode(invite);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load invite code";
      setInviteCodeError(message);
      setTeamInviteCode(null);
    } finally {
      setIsInviteCodeLoading(false);
    }
  }, [user?.id, user?.tenant_id]);

  useEffect(() => {
    if (!user || !canManageTeam) {
      setTeamInviteCode(null);
      setInviteCodeError(null);
      setIsInviteCodeLoading(false);
      return;
    }

    void loadTeamInviteCode();
  }, [canManageTeam, loadTeamInviteCode, user]);

  const handleRegenerateInviteCode = async () => {
    if (!user?.tenant_id || !user.id) return;

    setInviteCodeError(null);
    setIsInviteCodeLoading(true);

    try {
      const invite = await regenerateTenantParalegalInviteCode(
        user.tenant_id,
        user.id,
      );
      setTeamInviteCode(invite);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to regenerate code";
      setInviteCodeError(message);
      throw new Error(message);
    } finally {
      setIsInviteCodeLoading(false);
    }
  };

  const toggleUserAccess = async (member: Profile) => {
    const isRevoked = !!member.soft_deleted_at;
    const confirmed = await toast.confirm(
      `${isRevoked ? "Restore" : "Revoke"} access for ${member.display_name}?`,
      {
        confirmLabel: isRevoked ? "Restore access" : "Revoke access",
      },
    );
    if (!confirmed) return;

    try {
      if (isRevoked) {
        await restoreTeamMember(member.user_id, user!.tenant_id!, user!.id);
      } else {
        await removeTeamMember(member.user_id, user!.tenant_id!, user!.id);
      }
      await team.handler();
      toast.success(isRevoked ? "Access restored" : "Access revoked");
    } catch (error) {
      toast.errorFromUnknown(
        error,
        isRevoked ? "Failed to restore access" : "Failed to revoke access",
      );
    }
  };

  return (
    <div className="space-y-4">
      {user && canManageTeam && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Paralegal Invite Code</CardTitle>
            <CardDescription>
              Share this code with paralegals joining your tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInviteCodeLoading && !teamInviteCode ? (
              <CardSkeleton title="Invite Code" />
            ) : inviteCodeError ? (
              <p className="text-sm text-destructive">{inviteCodeError}</p>
            ) : teamInviteCode ? (
              <div className="rounded-2xl border border-border/70 bg-background px-5 py-6 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                  Current code
                </div>
                <code className="mt-3 block break-all text-4xl font-black tracking-[0.25em] text-foreground sm:text-5xl">
                  {teamInviteCode.token}
                </code>
                <p className="mt-3 text-sm text-muted-foreground">
                  Anyone using this code can join as a paralegal.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <AsyncButton
                type="button"
                variant="outline"
                onClick={handleRegenerateInviteCode}
                pendingText="Generating..."
              >
                Regenerate code
              </AsyncButton>
              <AsyncButton
                type="button"
                variant="ghost"
                onClick={loadTeamInviteCode}
                pendingText="Refreshing..."
              >
                Refresh
              </AsyncButton>
            </div>
          </CardContent>
        </Card>
      )}

      {user && canManageTeam && (
        <InviteMemberCard
          createdByUserId={user.id}
          tenantId={user.tenant_id}
          defaultRole="paralegal"
          allowedRoles={
            user.role === "tenant_admin"
              ? ["tenant_admin", "solicitor", "paralegal"]
              : ["solicitor", "paralegal"]
          }
          onInviteCreated={async () => {
            await team.handler();
          }}
        />
      )}

      {team.isLoading ? (
        <CardSkeleton title="Team Members" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            {team.data.members.length === 0 ? (
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
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.data.members.map((member) => (
                    <TableRow
                      key={member.user_id}
                      className={member.soft_deleted_at ? "opacity-70" : ""}
                    >
                      <TableCell>{member.display_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell className="capitalize">
                        {member.role.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.soft_deleted_at ? "Revoked" : "Active"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user?.role === "tenant_admin" &&
                        user?.id !== member.user_id ? (
                          <AsyncButton
                            size="sm"
                            variant={
                              member.soft_deleted_at ? "outline" : "destructive"
                            }
                            onClick={() => toggleUserAccess(member)}
                          >
                            {member.soft_deleted_at ? "Restore" : "Revoke"}
                          </AsyncButton>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
