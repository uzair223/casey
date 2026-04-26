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
  restoreTenantAccess,
  resendInvite,
} from "@/lib/supabase/mutations";
import {
  getTenantSignupInvites,
  getTenantsWithCounts,
} from "@/lib/supabase/queries";
import { InviteMemberCard } from "../shared/invite-member-card";
import { CardSkeleton } from "../shared/skeleton";
import { toast } from "@/lib/toast";

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
    const confirmed = await toast.confirm("Revoke this invite?", {
      confirmLabel: "Revoke invite",
    });
    if (!confirmed) return;

    try {
      await revokeInvite(inviteId);
      await tenantInvites.handler();
      toast.success("Invite revoked");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to revoke invite");
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
      toast.success("Invite resent");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to resend invite");
    }
  };

  const handleRevokeTenantAccess = async (
    tenantId: string,
    tenantName: string,
  ) => {
    const confirmed = await toast.confirm(`Revoke access for ${tenantName}?`, {
      description:
        "This will archive the organisation, remove member access, and block organisation-side recovery.",
      confirmLabel: "Revoke access",
    });
    if (!confirmed) {
      return;
    }

    try {
      await revokeTenantAccess(tenantId);
      await tenants.handler();
      await tenantInvites.handler();
      toast.success("Organisation access revoked");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to revoke organisation access");
    }
  };

  const handleRestoreTenantAccess = async (
    tenantId: string,
    tenantName: string,
  ) => {
    const confirmed = await toast.confirm(`Recover ${tenantName}?`, {
      description: "This restores organisation access.",
      confirmLabel: "Recover organisation",
    });
    if (!confirmed) {
      return;
    }

    try {
      await restoreTenantAccess(tenantId);
      await tenants.handler();
      await tenantInvites.handler();
      toast.success("Organisation access restored");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to recover organisation access");
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
        <CardSkeleton title="Existing Organisations" />
      ) : (
        <Card size="md">
          <CardHeader>
            <CardTitle>Existing Organisations</CardTitle>
          </CardHeader>
          <CardContent>
            {tenants.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No organisations found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground">
                        {tenant.softDeletedAt ? "Archived" : "Active"}
                      </TableCell>
                      <TableCell>{tenant.userCount}</TableCell>
                      <TableCell>{tenant.statementCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {tenant.softDeletedAt ? (
                          <AsyncButton
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRestoreTenantAccess(tenant.id, tenant.name)
                            }
                            pendingText="Recovering..."
                          >
                            Recover organisation
                          </AsyncButton>
                        ) : (
                          <AsyncButton
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRevokeTenantAccess(tenant.id, tenant.name)
                            }
                            pendingText="Revoking..."
                          >
                            Revoke access
                          </AsyncButton>
                        )}
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
        <CardSkeleton title="Organisation Invites" />
      ) : (
        <Card size="md">
          <CardHeader>
            <CardTitle>Organisation Invites</CardTitle>
          </CardHeader>
          <CardContent>
            {tenantInvites.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No organisation invites created yet.
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
