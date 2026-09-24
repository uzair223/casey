"use client";

import { useState } from "react";
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
import { apiFetch } from "@/lib/api-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { billingStatusLabel, planLabel, seatAllowanceLabel } from "@/lib/billing/plans";
import type { TenantWithCounts } from "@/types";

type AppAdminTenantsTabProps = {
  userId: string;
};

export function AppAdminTenantsTab({ userId }: AppAdminTenantsTabProps) {
  const tenants = useAsync(getTenantsWithCounts, [], { enabled: true });
  const tenantInvites = useAsync(getTenantSignupInvites, [], { enabled: true });
  const [billingTenant, setBillingTenant] = useState<TenantWithCounts | null>(
    null,
  );
  const [orderFirmName, setOrderFirmName] = useState("");
  const [orderStartDate, setOrderStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dpaSigned, setDpaSigned] = useState(false);
  const [organisationName, setOrganisationName] = useState("");
  const [inviteTenantId, setInviteTenantId] = useState("");

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

  const openBilling = (tenant: TenantWithCounts) => {
    setBillingTenant(tenant);
    setOrderFirmName(tenant.name);
    setOrderStartDate(new Date().toISOString().slice(0, 10));
    setDpaSigned(Boolean(tenant.dpaSignedAt));
  };

  const saveBilling = async () => {
    if (!billingTenant) return;
    await apiFetch(`/api/admin/tenants/${billingTenant.id}/billing`, {
      method: "POST",
      body: JSON.stringify({
        action: "save_order",
        dpaSigned,
        orderFirmName,
        orderStartDate,
      }),
    });
    await tenants.handler();
    toast.success("Order form saved");
  };

  const createOrganisation = async () => {
    const name = organisationName.trim();
    if (!name) {
      throw new Error("Organisation name is required");
    }
    const created = await apiFetch<{ id: string }>(`/api/admin/tenants`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setOrganisationName("");
    setInviteTenantId(created.id);
    await tenants.handler();
    toast.success("Organisation created");
  };

  const activeTenants = (tenants.data ?? []).filter(
    (tenant) => !tenant.softDeletedAt,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="organisation-name">Name</Label>
            <Input
              id="organisation-name"
              value={organisationName}
              onChange={(event) => setOrganisationName(event.target.value)}
              placeholder="Firm name"
            />
          </div>
          <AsyncButton onClick={createOrganisation} pendingText="Creating...">
            Create organisation
          </AsyncButton>
        </CardContent>
      </Card>

      <InviteMemberCard
        createdByUserId={userId}
        tenantId={inviteTenantId || null}
        organisations={activeTenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
        }))}
        onTenantIdChange={setInviteTenantId}
        defaultRole="tenant_admin"
        allowedRoles={["tenant_admin"]}
        onInviteCreated={refreshTenantInvites}
      />

      {!tenants.data || tenants.isLoading ? (
        <CardSkeleton title="Existing Organisations" />
      ) : (
        <Card>
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
                    <TableHead>Billing</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Accounts</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground">
                        {planLabel(tenant.plan)} ·{" "}
                        {billingStatusLabel(tenant.billingStatus)}
                      </TableCell>
                      <TableCell>{tenant.userCount}</TableCell>
                      <TableCell>{tenant.statementCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!tenant.softDeletedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openBilling(tenant)}
                          >
                            Billing
                          </Button>
                        ) : null}
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

      <Dialog
        open={Boolean(billingTenant)}
        onOpenChange={(open) => {
          if (!open) setBillingTenant(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Invoice {billingTenant?.name ?? "organisation"}
            </DialogTitle>
            <DialogDescription>
              Record the order form. The firm accepts 3 leads free, then
              chooses Starter or Growth in the product.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Firm name on order form</p>
              <Input
                value={orderFirmName}
                onChange={(event) => setOrderFirmName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Start date</p>
              <Input
                type="date"
                value={orderStartDate}
                onChange={(event) => setOrderStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Seats</p>
              <p className="text-sm text-muted-foreground">
                {seatAllowanceLabel(billingTenant?.plan)}
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={dpaSigned}
                onChange={(event) => setDpaSigned(event.target.checked)}
              />
              <span>
                DPA countersigned. Read the{" "}
                <a className="underline" href="/legal/dpa" target="_blank">
                  processor addendum
                </a>{" "}
                before invoicing.
              </span>
            </label>
          </div>
          <DialogFooter>
            <AsyncButton onClick={() => saveBilling()} pendingText="Saving...">
              Save order form
            </AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!tenantInvites.data || tenantInvites.isLoading ? (
        <CardSkeleton title="Organisation Invites" />
      ) : (
        <Card>
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
