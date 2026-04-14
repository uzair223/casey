"use client";

import { InvitesTable } from "../shared/invites-table";
import { AsyncButton } from "@/components/ui/async-button";
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
import {
  revokeInvite,
  revokeTenantAccess,
  resendInvite,
} from "@/lib/supabase/mutations";
import {
  getTenantSignupInvites,
  getTenantsWithCounts,
} from "@/lib/supabase/queries";
import { InviteMemberCard } from "../shared/invite-member-card";
import { CardSkeleton } from "../shared/skeleton";

type AppAdminTenantsTabProps = {
  userId: string;
};

export function AppAdminTenantsTab({ userId }: AppAdminTenantsTabProps) {
  const tenants = useAsync(getTenantsWithCounts, [], { enabled: true });
  const tenantInvites = useAsync(getTenantSignupInvites, [], { enabled: true });

  const refreshTenantInvites = async () => {
    await tenantInvites.handler();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return;

    try {
      await revokeInvite(inviteId);
      await tenantInvites.handler();
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
      await tenantInvites.handler();
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
      await revokeTenantAccess(tenantId);
      await tenants.handler();
      await tenantInvites.handler();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to revoke tenant access",
      );
    }
  };

  return (
    <div className="space-y-4">
      <InviteMemberCard
        size="md"
        createdByUserId={userId}
        tenantId={null}
        defaultRole="tenant_admin"
        allowedRoles={["tenant_admin", "app_admin"]}
        onInviteCreated={refreshTenantInvites}
      />

      {!tenants.data || tenants.isLoading ? (
        <CardSkeleton title="Existing Tenants" />
      ) : (
        <Card size="md">
          <CardHeader>
            <CardTitle>Existing Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {tenants.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenants found.</p>
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
                  {tenants.data.map((tenant) => (
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
      )}

      {!tenantInvites.data || tenantInvites.isLoading ? (
        <CardSkeleton title="Tenant Invites" />
      ) : (
        <Card size="md">
          <CardHeader>
            <CardTitle>Tenant Invites</CardTitle>
          </CardHeader>
          <CardContent>
            {tenantInvites.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tenant invites created yet.
              </p>
            ) : (
              <InvitesTable
                invites={tenantInvites.data}
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
