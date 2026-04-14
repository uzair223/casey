"use client";

import { InvitesTable } from "../shared/invites-table";
import { InviteMemberCard } from "../shared/invite-member-card";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsync } from "@/hooks/useAsync";
import { revokeInvite, resendInvite } from "@/lib/supabase/mutations";
import { getAppAdminInvites, getAppAdminMembers } from "@/lib/supabase/queries";
import { CardSkeleton } from "../shared/skeleton";

type AppAdminTabProps = {
  userId: string;
};

export function AppAdminMembersTab({ userId }: AppAdminTabProps) {
  const appAdmins = useAsync(getAppAdminMembers, [], { enabled: true });
  const appAdminInvites = useAsync(getAppAdminInvites, [], { enabled: true });

  const refreshInvites = async () => {
    await appAdminInvites.handler();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return;

    try {
      await revokeInvite(inviteId);
      await appAdminInvites.handler();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to revoke invite");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const { email, token } = await resendInvite(inviteId);
      if (email) {
        await fetch("/api/invites/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, token }),
        });
      }
      await appAdminInvites.handler();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to resend invite");
    }
  };

  return (
    <div className="space-y-4">
      <InviteMemberCard
        size="md"
        createdByUserId={userId}
        tenantId={null}
        defaultRole="app_admin"
        allowedRoles={["tenant_admin", "app_admin"]}
        onInviteCreated={refreshInvites}
      />

      {!appAdmins.data || appAdmins.isLoading ? (
        <CardSkeleton title="App Admin Team" />
      ) : (
        <Card size="md">
          <CardHeader>
            <CardTitle>App Admin Team</CardTitle>
          </CardHeader>
          <CardContent>
            {appAdmins.data.length === 0 ? (
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
                  {appAdmins.data.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>{member.display_name || "-"}</TableCell>
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
      )}

      {!appAdminInvites.data || appAdminInvites.isLoading ? (
        <CardSkeleton title="App Admin Invites" />
      ) : (
        <Card size="md">
          <CardHeader>
            <CardTitle>App Admin Invites</CardTitle>
          </CardHeader>
          <CardContent>
            {appAdminInvites.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No app admin invites created yet.
              </p>
            ) : (
              <InvitesTable
                invites={appAdminInvites.data}
                onResendInvite={handleResendInvite}
                onRevokeInvite={handleRevokeInvite}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
