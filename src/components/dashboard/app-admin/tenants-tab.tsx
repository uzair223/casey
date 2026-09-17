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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [seatLimit, setSeatLimit] = useState("5");
  const [orderFirmName, setOrderFirmName] = useState("");
  const [orderStartDate, setOrderStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dpaSigned, setDpaSigned] = useState(false);

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
    setSeatLimit(String(tenant.seatLimit || 5));
    setOrderFirmName(tenant.name);
    setOrderStartDate(new Date().toISOString().slice(0, 10));
    setDpaSigned(Boolean(tenant.dpaSignedAt));
  };

  const saveBilling = async (action: "save_order" | "send_invoice") => {
    if (!billingTenant) return;
    const result = await apiFetch<{ checkoutUrl?: string; updated?: boolean }>(
      `/api/admin/tenants/${billingTenant.id}/billing`,
      {
        method: "POST",
        body: JSON.stringify({
          action,
          seatLimit: Number(seatLimit),
          dpaSigned,
          orderFirmName,
          orderStartDate,
        }),
      },
    );
    if (result.checkoutUrl) {
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
    }
    await tenants.handler();
    toast.success(
      action === "send_invoice"
        ? "Stripe invoice session created"
        : "Order form saved",
    );
  };

  return (
    <div className="space-y-4">
      <InviteMemberCard
        createdByUserId={userId}
        tenantId={null}
        defaultRole="tenant_admin"
        allowedRoles={["tenant_admin", "app_admin"]}
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
                      <TableCell className="text-sm text-muted-foreground">
                        {tenant.billingStatus} · {tenant.seatLimit} seats
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
              Record the order form and DPA, then send a Stripe Checkout link.
              New subscriptions include a 7-day trial; a card is collected up
              front and billed when the trial ends.
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
              <Input
                type="number"
                min={1}
                value={seatLimit}
                onChange={(event) => setSeatLimit(event.target.value)}
              />
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
            <AsyncButton
              variant="outline"
              onClick={() => saveBilling("save_order")}
              pendingText="Saving..."
            >
              Save order form
            </AsyncButton>
            <AsyncButton
              onClick={() => saveBilling("send_invoice")}
              pendingText="Opening Stripe..."
            >
              Send Stripe invoice
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
