"use client";

import { useCallback, useEffect, useState } from "react";
import { useUserProtected } from "@/contexts/user-context";
import { apiFetch } from "@/lib/api-utils";
import {
  getOwnAccountDeletionRequests,
  getTenantSettings,
} from "@/lib/supabase/queries";
import {
  createOwnAccountDeletionRequest,
  softDeleteTenant,
  updateCurrentUserProfile,
  updateTenantSettings,
} from "@/lib/supabase/mutations";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageTitle } from "@/components/page-title";
import Loading from "@/components/loading";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotificationPreferencesCard } from "@/components/settings/notification-preferences-card";

export default function TenantSettingsPage() {
  const { user, refreshUser } = useUserProtected([
    "app_admin",
    "tenant_admin",
    "solicitor",
    "paralegal",
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [dataRetentionDays, setDataRetentionDays] = useState("365");
  const [status, setStatus] = useState<string | null>(null);
  const [pendingDeletionRequest, setPendingDeletionRequest] =
    useState<boolean>(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    const requests = await getOwnAccountDeletionRequests(user.id);

    setDisplayName(user.display_name ?? "");
    setPendingDeletionRequest(
      requests.some((request) => request.status === "pending"),
    );

    if (user?.role === "tenant_admin" && user.tenant_id) {
      const tenant = await getTenantSettings(user.tenant_id);
      setName(tenant.name);
      setDataRetentionDays(String(tenant.data_retention_days));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings()
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to load settings";
        setStatus(message);
      })
      .finally(() => setIsLoading(false));
  }, [user, loadSettings]);

  if (isLoading) {
    return <Loading />;
  }

  const canManageTenant = user?.role === "tenant_admin";
  const canManageNotifications =
    user?.role === "tenant_admin" || user?.role === "solicitor";
  const canDirectDelete =
    user?.role === "tenant_admin" || user?.role === "app_admin";

  const handleSaveProfile = async () => {
    setStatus(null);

    await updateCurrentUserProfile(user!.id, displayName);
    await refreshUser();
    setStatus("Profile updated");
  };

  const handleSaveTenant = async () => {
    if (!canManageTenant) return;
    setStatus(null);

    const retention = Number(dataRetentionDays);
    if (!Number.isInteger(retention) || retention < 30 || retention > 3650) {
      throw new Error("Data retention must be between 30 and 3650 days");
    }

    await updateTenantSettings(user!.tenant_id!, {
      name,
      dataRetentionDays: retention,
    });
    refreshUser();

    setStatus("Settings saved");
  };

  const handleSoftDelete = async () => {
    if (!canManageTenant) return;
    setStatus(null);
    const ok = confirm(
      "Soft-delete tenant? Data access will be blocked immediately and permanent deletion happens after 90 days unless restored.",
    );
    if (!ok) return;

    await softDeleteTenant(user!.tenant_id!);

    setStatus(
      "Tenant soft-deleted. Sign out and restore from login within 90 days.",
    );
  };

  const handleExportDsar = async (scope: "user" | "tenant") => {
    setStatus(null);
    // Kept as API route: server assembles export payload and records DSAR audit event.
    const data = await apiFetch<Record<string, unknown>>(
      `/api/dsar/export?scope=${scope}`,
      {
        method: "GET",
      },
    );

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dsar-${scope}-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("DSAR export generated");
  };

  const handleRequestAccountDeletion = async () => {
    setStatus(null);
    await createOwnAccountDeletionRequest(
      user!.id,
      user!.tenant_id ?? null,
      null,
    );
    setPendingDeletionRequest(true);
    setStatus("Account deletion request submitted to tenant admins");
  };

  const handleDeleteOwnAccount = async () => {
    setStatus(null);
    const confirmed = confirm(
      "Delete your own account now? This action is irreversible.",
    );
    if (!confirmed) return;

    // Kept as API route: direct account deletion uses auth.admin.deleteUser.
    await apiFetch<{ ok: boolean }>("/api/profile", {
      method: "DELETE",
    });

    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={user?.tenant_name ?? undefined}
        title="Settings"
        description="Manage profile, organization controls, and compliance exports."
      />
      <div className="grid grid-cols-2 gap-4">
        {(user?.role === "app_admin" ||
          user?.role === "tenant_admin" ||
          user?.role === "solicitor") && (
          <>
            <Card size="md">
              <CardHeader>
                <CardTitle>Case Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Manage case templates, favourite/default case templates, and
                  allowed/default witness templates for each case template.
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline">
                  <Link href="/settings/cases">
                    Open case template settings
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            <Card size="md">
              <CardHeader>
                <CardTitle>Statement Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Manage statement intake templates with Basic field editing and
                  an Advanced raw JSON editor.
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline">
                  <Link href="/settings/statements">
                    Open statement template settings
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </>
        )}

        <Card size="md" className="col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Display name</p>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your display name"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Role</p>
              <Input value={user?.role ?? ""} disabled />
            </div>
          </CardContent>
          <CardFooter>
            <AsyncButton onClick={handleSaveProfile} pendingText="Saving...">
              Save profile
            </AsyncButton>
          </CardFooter>
        </Card>

        {canManageNotifications && (
          <NotificationPreferencesCard
            tenantId={user!.tenant_id!}
            userId={user!.id}
            onStatusChange={setStatus}
          />
        )}

        {canManageTenant && (
          <Card size="md" className="col-span-2">
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Tenant name</p>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tenant name"
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Data retention (days)</p>
                <Input
                  type="number"
                  min={30}
                  max={3650}
                  value={dataRetentionDays}
                  onChange={(event) => setDataRetentionDays(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Configure how long data is retained for your tenant.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <AsyncButton onClick={handleSaveTenant} pendingText="Saving...">
                Save organisation settings
              </AsyncButton>
            </CardFooter>
          </Card>
        )}

        <Card size="md" className="col-span-2">
          <CardHeader>
            <CardTitle>Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Generate a data export for subject access and compliance review.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <AsyncButton
              variant="outline"
              onClick={async () => handleExportDsar("user")}
              pendingText="Generating..."
            >
              Export my data
            </AsyncButton>
            {canManageTenant && (
              <AsyncButton
                variant="outline"
                onClick={async () => handleExportDsar("tenant")}
                pendingText="Generating..."
              >
                Export tenant data
              </AsyncButton>
            )}
          </CardFooter>
        </Card>

        <Card size="md" variant="destructive" className="col-span-2">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {canManageTenant ? (
              <>
                <p>
                  Close your organisation. Data access is blocked immediately by
                  RLS.
                </p>
                <p>
                  Permanent deletion occurs after 90 days unless an admin
                  restores the organisation by signing in.
                </p>
              </>
            ) : (
              <>
                <p>Request deletion of your account from this organisation.</p>
                <p>
                  Your tenant admin will review and process this request on the
                  Team page.
                </p>
              </>
            )}
          </CardContent>
          <CardFooter>
            {canManageTenant ? (
              <AsyncButton
                variant="outline-destructive"
                onClick={handleSoftDelete}
                pendingText="Deleting organisation..."
              >
                Close organisation
              </AsyncButton>
            ) : canDirectDelete ? (
              <AsyncButton
                variant="outline-destructive"
                onClick={handleDeleteOwnAccount}
                pendingText="Deleting account..."
              >
                Delete my account now
              </AsyncButton>
            ) : (
              <AsyncButton
                variant="outline-destructive"
                onClick={handleRequestAccountDeletion}
                pendingText="Submitting request..."
                disabled={pendingDeletionRequest}
              >
                {pendingDeletionRequest
                  ? "Deletion request pending"
                  : "Request account deletion"}
              </AsyncButton>
            )}
          </CardFooter>
        </Card>

        {status ? (
          <Card size="md" className="col-span-2">
            <CardContent className="py-4 text-sm">{status}</CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
