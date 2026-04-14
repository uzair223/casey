"use client";

import { InviteMemberCard } from "@/components/dashboard/shared/invite-member-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function TenantRoleTeamTab() {
  const { user } = useUser();
  const { team } = useTenant();
  const canManageTeam = useCanManageTeam();

  return (
    <div className="space-y-4">
      {user && canManageTeam && (
        <InviteMemberCard
          size="md"
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
        <Card size="md">
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
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.data.members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>{member.display_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell className="capitalize">
                        {member.role.replace("_", " ")}
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
    </div>
  );
}
