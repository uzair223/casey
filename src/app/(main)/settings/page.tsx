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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationPreferencesCard } from "@/components/settings/notification-preferences-card";
import { LeadAllowanceMeter } from "@/components/billing/lead-allowance-meter";
import { PlanActionsMenu } from "@/components/billing/plan-actions";
import { toast } from "@/lib/toast";
import { startPlanCheckout } from "@/lib/billing/client";
import {
  billingStatusLabel,
  normalizeTenantPlan,
  planLabel,
} from "@/lib/billing/plans";
import type { SubscriptionSummary } from "@/lib/billing/subscription-summary";

function formatPeriodEnd(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function billingStatusVariant(status: string | null) {
  if (status === "active") return "accent" as const;
  if (status === "past_due") return "warning" as const;
  if (status === "canceled") return "destructive" as const;
  return "secondary" as const;
}

export default function TenantSettingsPage() {
  const { user, refreshUser } = useUserProtected([
    "app_admin",
    "tenant_admin",
    "solicitor",
    "paralegal",
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [name, setName] = useState("");
  const [dataRetentionDays, setDataRetentionDays] = useState("365");
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("trial");
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(
    null,
  );
  const [pendingDeletionRequest, setPendingDeletionRequest] =
    useState<boolean>(false);

  const refreshHasPassword = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data: hasPassword, error: rpcError } =
      await supabase.rpc("user_has_password");
    if (rpcError) {
      throw new Error(rpcError.message || "Failed to verify password status");
    }
    setHasPassword(!!hasPassword);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    const requests = await getOwnAccountDeletionRequests(user.id);

    setDisplayName(user.display_name ?? "");
    setPendingDeletionRequest(
      requests.some((request) => request.status === "pending"),
    );

    await refreshHasPassword();

    if (user.role === "tenant_admin" && user.tenant_id) {
      const tenant = await getTenantSettings(user.tenant_id);
      setName(tenant.name);
      setDataRetentionDays(String(tenant.data_retention_days));
      setSeatLimit(tenant.seat_limit);
      setBillingStatus(tenant.billing_status);
      setPlan(tenant.plan);
      try {
        setSubscription(
          await apiFetch<SubscriptionSummary>("/api/tenant/billing/subscription"),
        );
      } catch {
        setSubscription(null);
      }
    }
  }, [refreshHasPassword, user]);

  useEffect(() => {
    if (!user) return;

    loadSettings()
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to load settings";
        toast.error(message);
      })
      .finally(() => setIsLoading(false));
  }, [user, loadSettings]);

  if (isLoading || !user) {
    return <Loading />;
  }

  const canManageTenant = user.role === "tenant_admin";
  const canManageNotifications =
    user.role === "tenant_admin" || user.role === "solicitor";
  const canDirectDelete =
    user.role === "tenant_admin" || user.role === "app_admin";

  const handleSaveProfile = async () => {
    try {
      await updateCurrentUserProfile(user.id, displayName);
      await refreshUser();
      toast.success("Profile updated");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to update profile");
      throw error;
    }
  };

  const handleForgotPassword = async () => {
    try {
      const email = user?.email;
      if (!email) {
        throw new Error("Could not send reset email for this account");
      }
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ email }),
      });
      toast.success("Password reset email sent");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send reset email";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleSavePassword = async () => {
    try {
      const supabase = getSupabaseClient();
      await refreshHasPassword();

      if (hasPassword) {
        if (!currentPassword.trim()) {
          throw new Error("Current password is required");
        }

        const email = user?.email;
        if (!email) {
          throw new Error("Could not verify current password for this account");
        }

        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

        if (verifyError) {
          throw new Error("Current password is incorrect");
        }
      }

      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setHasPassword(true);
      toast.success(
        "Password updated. You can now use optional password sign-in from the auth page.",
      );
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to update password");
      throw error;
    }
  };

  const handleSaveTenant = async () => {
    if (!canManageTenant) return;

    try {
      const retention = Number(dataRetentionDays);
      if (!Number.isInteger(retention) || retention < 30 || retention > 3650) {
        throw new Error("Data retention must be between 30 and 3650 days");
      }

      await updateTenantSettings(user.tenant_id!, {
        name,
        dataRetentionDays: retention,
      });
      refreshUser();

      toast.success("Settings saved");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to save organisation settings");
      throw error;
    }
  };

  const handleSoftDelete = async () => {
    if (!canManageTenant) return;
    const retention = Number(dataRetentionDays);
    const retentionLabel = Number.isInteger(retention)
      ? `${retention} days`
      : "the data retention period";
    const ok = await toast.confirm("Close this organisation?", {
      description: `Data access will be blocked immediately. Casey deletes the organisation after ${retentionLabel} unless it is restored.`,
      confirmLabel: "Close organisation",
    });
    if (!ok) return;

    await softDeleteTenant(user.tenant_id!);

    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/auth?tenantClosed=1";
  };

  const handleCancelSubscription = async () => {
    const confirmed = await toast.confirm("Cancel the subscription?", {
      description:
        "It stays active until the end of the current period, then it stops. You can keep it before that date.",
      confirmLabel: "Cancel at period end",
    });
    if (!confirmed) return;
    if (!subscription?.hasSubscription) {
      toast.error("There is no Stripe subscription to cancel");
      return;
    }
    try {
      const summary = await apiFetch<SubscriptionSummary>(
        "/api/tenant/billing/subscription",
        {
          method: "POST",
          body: JSON.stringify({ cancelAtPeriodEnd: true }),
        },
      );
      setSubscription(summary);
      const when = summary.periodEnd
        ? ` on ${formatPeriodEnd(summary.periodEnd)}`
        : "";
      toast.success(`Subscription cancels${when}`);
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to cancel the subscription");
    }
  };

  const handleKeepSubscription = async () => {
    try {
      const summary = await apiFetch<SubscriptionSummary>(
        "/api/tenant/billing/subscription",
        {
          method: "POST",
          body: JSON.stringify({ cancelAtPeriodEnd: false }),
        },
      );
      setSubscription(summary);
      toast.success("Subscription will continue");
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to keep the subscription");
    }
  };

  const switchPlan = async (kind: "starter" | "growth") => {
    try {
      await startPlanCheckout({ kind });
    } catch (error) {
      toast.errorFromUnknown(error, "Failed to open checkout");
    }
  };

  const handleExportDsar = async (scope: "user" | "tenant") => {
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
    toast.success("DSAR export generated");
  };

  const handleRequestAccountDeletion = async () => {
    await createOwnAccountDeletionRequest(
      user.id,
      user.tenant_id ?? null,
      null,
    );
    setPendingDeletionRequest(true);
    toast.success("Account deletion request submitted to firm admins");
  };

  const handleDeleteOwnAccount = async () => {
    const confirmed = await toast.confirm("Delete your own account now?", {
      description: "This action is irreversible.",
      confirmLabel: "Delete account",
    });
    if (!confirmed) return;

    // Kept as API route: direct account deletion uses auth.admin.deleteUser.
    await apiFetch<{ ok: boolean }>("/api/profile", {
      method: "DELETE",
    });

    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const showOrganisation =
    user.role === "app_admin" ||
    user.role === "tenant_admin" ||
    user.role === "solicitor";

  return (
    <section className="space-y-4">
      <PageTitle
        title="Settings"
        description="Your account, and the organisation's page, templates, and compliance exports."
      />
      <Tabs defaultValue="user" className="space-y-4">
        <TabsList>
          <TabsTrigger value="user">User</TabsTrigger>
          {showOrganisation ? (
            <TabsTrigger value="organisation">Organisation</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="user">
          <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-2">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-4 gap-y-2 space-y-0 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="settings-display-name">Display name</Label>
                <Input
                  id="settings-display-name"
                  autoComplete="nickname"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="settings-role">Role</Label>
                <Input id="settings-role" value={user?.role ?? ""} disabled />
              </div>
            </CardContent>
            <CardFooter>
              <AsyncButton
                type="submit"
                onClick={async (event) => {
                  event.preventDefault();
                  await handleSaveProfile();
                }}
                pendingText="Saving..."
              >
                Save profile
              </AsyncButton>
            </CardFooter>
          </form>
        </Card>

        <Card className="col-span-2">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={user.email ?? ""}
              readOnly
              tabIndex={-1}
              aria-hidden
              className="sr-only"
            />
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Authentication</CardTitle>
                <Badge variant={hasPassword ? "accent" : "secondary"}>
                  {hasPassword ? "Password set" : "Password not set"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-x-4 gap-y-2 space-y-0 md:grid-cols-2">
              {hasPassword ? (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="settings-current-password">
                    Current password
                  </Label>
                  <Input
                    id="settings-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Enter your current password"
                  />
                  <AsyncButton
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 py-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    onClick={handleForgotPassword}
                    pendingText="Sending reset email..."
                  >
                    Forgot password?
                  </AsyncButton>
                </div>
              ) : null}

              <div className="space-y-1">
                <Label htmlFor="settings-new-password">New password</Label>
                <Input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="settings-confirm-password">
                  Confirm new password
                </Label>
                <Input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                Magic links are the recommended sign-in method. Password login is
                optional.
              </p>
            </CardContent>
            <CardFooter>
              <AsyncButton
                type="submit"
                onClick={async (event) => {
                  event.preventDefault();
                  await handleSavePassword();
                }}
                pendingText="Updating password..."
              >
                {hasPassword ? "Update password" : "Set password"}
              </AsyncButton>
            </CardFooter>
          </form>
        </Card>

        {canManageNotifications ? (
          <NotificationPreferencesCard
            tenantId={user.tenant_id!}
            userId={user.id}
          />
        ) : null}

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Generate a data export for your account.</p>
          </CardContent>
          <CardFooter>
            <AsyncButton
              variant="outline"
              onClick={async () => handleExportDsar("user")}
              pendingText="Generating..."
            >
              Export my data
            </AsyncButton>
          </CardFooter>
        </Card>

        {!canManageTenant ? (
          <Card variant="destructive" className="col-span-2">
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {canDirectDelete ? (
                <p>Delete your account. This cannot be undone.</p>
              ) : (
                <>
                  <p>Request deletion of your account from this organisation.</p>
                  <p>
                    Your firm admin will review and process this request on the
                    Team page.
                  </p>
                </>
              )}
            </CardContent>
            <CardFooter>
              {canDirectDelete ? (
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
        ) : null}
          </div>
        </TabsContent>
        {showOrganisation ? (
          <TabsContent value="organisation">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lead types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Manage lead types, the default type, and the account
                    templates used after a lead is accepted.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline">
                    <Link href="/settings/cases">Open lead type settings</Link>
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Account templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Manage the questions and document sections used after a lead
                    is accepted, with Basic field editing and an Advanced raw
                    JSON editor.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline">
                    <Link href="/settings/statements">
                      Open account template settings
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
              {canManageTenant ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Public intake</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      The hosted enquiry page, its address, and the branding
                      enquirers see.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline">
                      <Link href="/settings/intake">Open public intake</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ) : null}
              {canManageTenant ? (
          <Card className="col-span-2">
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <CardHeader>
                <CardTitle>Organisation</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-4 gap-y-3 space-y-0 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="settings-org-name">Organisation name</Label>
                  <Input
                    id="settings-org-name"
                    autoComplete="organization"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Organisation name"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="settings-retention">
                    Data retention (days)
                  </Label>
                  <Input
                    id="settings-retention"
                    type="number"
                    min={30}
                    max={3650}
                    value={dataRetentionDays}
                    onChange={(event) =>
                      setDataRetentionDays(event.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    After the organisation is closed, Casey keeps its data for
                    this many days, then deletes it. Live matters are not
                    deleted on this timer.
                  </p>
                </div>
                <div className="space-y-1 border-t border-border pt-3 md:col-span-2">
                  {seatLimit == null ? (
                    <>
                      <p className="text-sm font-medium">Plan</p>
                      <p className="text-sm text-muted-foreground">
                        The plan is managed by Casey.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium">Plan</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="rounded-full">
                              {planLabel(plan)}
                            </Badge>
                            <Badge
                              variant={billingStatusVariant(billingStatus)}
                              className="rounded-full"
                            >
                              {billingStatusLabel(billingStatus)}
                            </Badge>
                          </div>
                          {subscription?.periodEnd ? (
                            <p className="text-xs text-muted-foreground">
                              {subscription.cancelAtPeriodEnd
                                ? "Ends"
                                : "Renews"}{" "}
                              on {formatPeriodEnd(subscription.periodEnd)}
                            </p>
                          ) : null}
                        </div>
                        <PlanActionsMenu
                          items={
                            normalizeTenantPlan(plan) === "trial"
                              ? [
                                  {
                                    label: "Switch to Starter",
                                    onSelect: () => {
                                      void switchPlan("starter");
                                    },
                                  },
                                  {
                                    label: "Switch to Growth",
                                    onSelect: () => {
                                      void switchPlan("growth");
                                    },
                                  },
                                ]
                              : [
                                  {
                                    label: `Switch to ${planLabel(
                                      normalizeTenantPlan(plan) === "growth"
                                        ? "starter"
                                        : "growth",
                                    )}`,
                                    onSelect: () => {
                                      void switchPlan(
                                        normalizeTenantPlan(plan) === "growth"
                                          ? "starter"
                                          : "growth",
                                      );
                                    },
                                  },
                                  subscription?.cancelAtPeriodEnd
                                    ? {
                                        label: "Keep subscription",
                                        onSelect: () => {
                                          void handleKeepSubscription();
                                        },
                                      }
                                    : {
                                        label: "Cancel",
                                        destructive: true,
                                        onSelect: () => {
                                          void handleCancelSubscription();
                                        },
                                      },
                                ]
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
                <LeadAllowanceMeter className="border-t border-border pt-3 md:col-span-2" />
              </CardContent>
              <CardFooter>
                <AsyncButton
                  type="submit"
                  onClick={async (event) => {
                    event.preventDefault();
                    await handleSaveTenant();
                  }}
                  pendingText="Saving..."
                >
                  Save organisation settings
                </AsyncButton>
              </CardFooter>
            </form>
          </Card>
        ) : null}

              {canManageTenant ? (
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle>Compliance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Generate a data export for subject access and compliance
                      review.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <AsyncButton
                      variant="outline"
                      onClick={async () => handleExportDsar("tenant")}
                      pendingText="Generating..."
                    >
                      Export organisation data
                    </AsyncButton>
                  </CardFooter>
                </Card>
              ) : null}
              {canManageTenant ? (
                <Card variant="destructive" className="col-span-2">
                  <CardHeader>
                    <CardTitle>Danger zone</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      Close your organisation. Data access is blocked immediately
                      by RLS.
                    </p>
                    <p>
                      Permanent deletion occurs after {dataRetentionDays} days
                      unless an admin restores the organisation by signing in.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <AsyncButton
                      variant="outline-destructive"
                      onClick={handleSoftDelete}
                      pendingText="Deleting organisation..."
                    >
                      Close organisation
                    </AsyncButton>
                  </CardFooter>
                </Card>
              ) : null}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
