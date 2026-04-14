"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/user-context";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { RhfField } from "@/components/ui/rhf-field";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InviteWithTenantName } from "@/types";
import { apiFetch } from "@/lib/api-utils";
import { getAuthURL, getRoleLabel } from "@/lib/utils";
import { WaitlistSignupForm } from "@/components/waitlist/waitlist-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import Loading from "@/components/loading";

function AuthPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Casey";

  const { user, isLoading: isUserLoading, refreshUser } = useUser();
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [tenantLifecycle, setTenantLifecycle] = useState<{
    exists: boolean;
    softDeleted: boolean;
    name?: string;
    softDeletedAt?: string | null;
    purgeAfter?: string | null;
    canRestore?: boolean;
  } | null>(null);
  const [isCheckingLifecycle, setIsCheckingLifecycle] = useState(false);

  const [inviteInfo, setInviteInfo] = useState<InviteWithTenantName | null>(
    null,
  );

  useEffect(() => {
    if (searchParams.get("tenantClosed") === "1") {
      setSuccessStatus(
        "Organisation closed and you have been signed out. Sign in again to restore your tenant within 90 days.",
      );

      const params = new URLSearchParams(searchParams.toString());
      params.delete("tenantClosed");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }, [searchParams, router, pathname]);

  const setErrorStatus = (message: string) => {
    setStatus({ type: "error", message });
  };

  const setSuccessStatus = (message: string) => {
    setStatus({ type: "success", message });
  };

  const authForm = useForm<{ email: string }>({ defaultValues: { email: "" } });
  const lookupInviteForm = useForm<{ inviteCode: string }>({
    defaultValues: { inviteCode: "" },
  });
  const acceptInviteForm = useForm<{ displayName: string; firmName: string }>({
    defaultValues: { displayName: "", firmName: "" },
  });

  useEffect(() => {
    if (isUserLoading || !user?.tenant_id) {
      setTenantLifecycle(null);
      return;
    }

    setIsCheckingLifecycle(true);
    apiFetch<{
      exists: boolean;
      softDeleted: boolean;
      name?: string;
      softDeletedAt?: string | null;
      purgeAfter?: string | null;
      canRestore?: boolean;
    }>("/api/tenant/lifecycle", { method: "GET" })
      .then((data) => {
        setTenantLifecycle(data);
      })
      .catch(() => {
        setTenantLifecycle(null);
      })
      .finally(() => setIsCheckingLifecycle(false));
  }, [isUserLoading, user?.tenant_id]);

  // Redirect logic after loading completes
  useEffect(() => {
    if (!isUserLoading && user && !isCheckingLifecycle) {
      // Only proceed if user has accepted an invite (role is not "user")
      if (user.role === "user") {
        // User hasn't accepted an invite yet, stay on auth page
        return;
      }

      // For tenant-scoped users, wait until lifecycle state is resolved.
      // This avoids auth -> dashboard redirects racing ahead of soft-delete checks.
      if (user.tenant_id && user.role !== "app_admin" && !tenantLifecycle) {
        return;
      }

      if (tenantLifecycle?.softDeleted) {
        return;
      }

      // User is fully set up, redirect to dashboard
      if (user.tenant_id || user.role === "app_admin") {
        router.replace("/dashboard");
      }
    }
  }, [user, isUserLoading, isCheckingLifecycle, tenantLifecycle, router]);

  useEffect(() => {
    const inviteCode = searchParams.get("invite");
    if (inviteCode) {
      lookupInviteForm.setValue("inviteCode", inviteCode);
    }
  }, [searchParams, lookupInviteForm]);

  if (isUserLoading) {
    return <Loading />;
  }

  const handleMagicLink: SubmitHandler<{ email: string }> = async ({
    email,
  }) => {
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      const emailRedirectTo = getAuthURL(
        lookupInviteForm.getValues("inviteCode"),
      );
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessStatus(
        "Check your email for the magic link. It may take a minute to arrive. Be sure to check your spam folder!",
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send magic link";
      setErrorStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleLookupInvite: SubmitHandler<{ inviteCode: string }> = async ({
    inviteCode,
  }) => {
    if (!inviteCode.trim()) {
      const error = "Invite code is required.";
      setErrorStatus(error);
      throw new Error(error);
    }

    const token = inviteCode.trim();
    setStatus(null);

    try {
      const { invite } = await apiFetch<{ invite: InviteWithTenantName }>(
        `/api/invites/accept/${token}`,
        { method: "GET" },
      );
      setInviteInfo(invite);
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to accept invite";
      setErrorStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleAcceptInvite: SubmitHandler<{
    displayName: string;
    firmName: string;
  }> = async ({ displayName, firmName }) => {
    if (!inviteInfo) {
      const error = "No invite information available.";
      setErrorStatus(error);
      throw new Error(error);
    }

    if (!displayName.trim()) {
      const error = "Display name is required";
      setErrorStatus(error);
      throw new Error(error);
    }

    const needsFirmName =
      inviteInfo.role === "tenant_admin" && !inviteInfo.tenant_id;
    if (needsFirmName && !firmName.trim()) {
      const error = "Firm name is required";
      setErrorStatus(error);
      throw new Error(error);
    }

    try {
      const res = await apiFetch<{ success: boolean; error?: string }>(
        `/api/invites/accept/${inviteInfo.token}`,
        {
          method: "POST",
          body: JSON.stringify({
            displayName: displayName.trim(),
            firmName: needsFirmName ? firmName.trim() : undefined,
          }),
        },
      );
      if (!res.success) {
        throw new Error(res.error || "Failed to accept invite");
      }
      await refreshUser();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to accept invite";
      setErrorStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleRestoreTenant = async () => {
    setStatus(null);
    try {
      await apiFetch<{ ok: boolean }>("/api/tenant/lifecycle", {
        method: "POST",
      });
      await refreshUser();
      setTenantLifecycle((prev) =>
        prev
          ? {
              ...prev,
              softDeleted: false,
              canRestore: false,
              softDeletedAt: null,
              purgeAfter: null,
            }
          : prev,
      );
      router.replace("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restore tenant";
      setErrorStatus(message);
      throw new Error(message);
    }
  };

  return (
    <section className="relative container min-h-screen py-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <aside>
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-foreground">
              {appName}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-primary">
              Sign in, join your firm workspace, and start intake in minutes.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Built for legal teams that need secure witness intake, clean
              handoffs, and auditable workflows from first contact.
            </p>

            <div className="mt-6 space-y-3">
              {[
                {
                  icon: MailCheck,
                  title: "Magic link login",
                  body: "No passwords to manage. Use your work email.",
                },
                {
                  icon: Building2,
                  title: "Firm workspace onboarding",
                  body: "Join existing teams or set up a new tenant-admin workspace.",
                },
                {
                  icon: ShieldCheck,
                  title: "Security by default",
                  body: "Tenant-isolated data with controlled lifecycle and restore paths.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/60 bg-background/60 p-3"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <item.icon className="h-4 w-4 text-accent-foreground" />
                    {item.title}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1">
                <BadgeCheck className="h-3.5 w-3.5 text-accent-foreground" />
                UK legal workflow focused
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1">
                <BadgeCheck className="h-3.5 w-3.5 text-accent-foreground" />
                Invite-led access control
              </span>
            </div>
          </div>
          <Button asChild className="mt-4 pl-2" variant="ghost">
            <Link href="/">
              <ChevronLeft className="h-4 w-4" />
              Homepage
            </Link>
          </Button>
        </aside>

        <div className="space-y-6">
          {status ? (
            <Card
              size="md"
              className={
                status.type === "error"
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-emerald-500/40 bg-emerald-500/5"
              }
            >
              <CardHeader className="text-sm">{status.message}</CardHeader>
            </Card>
          ) : null}

          {!user ? (
            <Card className="border-border/70 bg-card/85">
              <CardHeader>
                <span className="mb-0 text-xs uppercase tracking-[0.2em] text-accent-foreground">
                  Step 1
                </span>
                <h2 className="text-2xl font-display">Secure sign-in</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your work email and we&apos;ll send a one-time magic
                  link.
                </p>
              </CardHeader>
              <FormProvider {...authForm}>
                <form onSubmit={authForm.handleSubmit(handleMagicLink)}>
                  <CardContent>
                    <RhfField
                      form={authForm}
                      name="email"
                      controlId="auth-email"
                      label="Email"
                      registerOptions={{ required: true }}
                      renderControl={(registration, required) => (
                        <Input
                          id="auth-email"
                          type="email"
                          placeholder="name@firm.co.uk"
                          required={required}
                          {...registration}
                        />
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <AsyncButton
                      className="w-full"
                      type="submit"
                      pendingText="Sending..."
                    >
                      Send magic link
                    </AsyncButton>
                  </CardFooter>
                </form>
              </FormProvider>
            </Card>
          ) : null}

          {user && tenantLifecycle?.softDeleted ? (
            <Card className="border-warning/40 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-[0.2em]">
                  Tenant archived
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tenantLifecycle.name || "Your tenant"} has been soft-deleted.
                  Data access is currently blocked.
                </p>
                <p className="text-xs text-muted-foreground">
                  Permanent deletion date:{" "}
                  {tenantLifecycle.purgeAfter || "unknown"}
                </p>
              </CardHeader>
              {tenantLifecycle.canRestore ? (
                <CardFooter>
                  <AsyncButton
                    className="w-full"
                    onClick={handleRestoreTenant}
                    pendingText="Restoring..."
                  >
                    Restore tenant
                  </AsyncButton>
                </CardFooter>
              ) : (
                <CardFooter>
                  <p className="text-sm text-muted-foreground">
                    Contact your tenant admin to restore access.
                  </p>
                </CardFooter>
              )}
            </Card>
          ) : null}

          {user?.tenant_id === null && user?.role !== "app_admin" ? (
            !inviteInfo ? (
              <FormProvider key="lookup-invite" {...lookupInviteForm}>
                <form
                  onSubmit={lookupInviteForm.handleSubmit(handleLookupInvite)}
                >
                  <Card className="border-border/70 bg-card/85">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-[0.2em]">
                        Step 2: Join your firm workspace
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Enter the invite code sent by your firm admin.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2 border-t pt-4">
                      <RhfField
                        form={lookupInviteForm}
                        name="inviteCode"
                        controlId="invite-code"
                        label="Invite code"
                        registerOptions={{ required: true }}
                        renderControl={(registration, required) => (
                          <Input
                            id="invite-code"
                            placeholder="Paste invite code here"
                            required={required}
                            {...registration}
                          />
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sent via email or shared internally by your firm.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <AsyncButton
                        className="w-full"
                        type="submit"
                        variant="secondary"
                        pendingText="Looking up..."
                      >
                        Look up invite
                      </AsyncButton>
                    </CardFooter>
                  </Card>
                </form>
              </FormProvider>
            ) : (
              <FormProvider key="accept-invite" {...acceptInviteForm}>
                <form
                  onSubmit={acceptInviteForm.handleSubmit(handleAcceptInvite)}
                >
                  <Card className="border-border/70 bg-card/85">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-[0.2em]">
                        Step 3: Confirm access
                      </CardTitle>
                      {inviteInfo.tenant_id ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            You have been invited to join
                          </p>
                          <p className="text-lg font-semibold text-primary">
                            {inviteInfo.tenant_name}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          You have been invited to join the platform.
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Role: {getRoleLabel(inviteInfo.role)}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 border-t pt-4">
                      <RhfField
                        form={acceptInviteForm}
                        name="displayName"
                        controlId="display-name"
                        label="Display Name"
                        registerOptions={{ required: true }}
                        renderControl={(registration, required) => (
                          <Input
                            id="display-name"
                            type="text"
                            placeholder="John Smith"
                            required={required}
                            {...registration}
                          />
                        )}
                      />

                      {inviteInfo.role === "tenant_admin" &&
                      !inviteInfo.tenant_id ? (
                        <div className="space-y-4">
                          <RhfField
                            form={acceptInviteForm}
                            name="firmName"
                            controlId="firm-name"
                            label="Firm Name"
                            registerOptions={{ required: true }}
                            renderControl={(registration, required) => (
                              <Input
                                id="firm-name"
                                type="text"
                                placeholder="Your Law Firm Ltd"
                                required={required}
                                {...registration}
                              />
                            )}
                          />
                          <p className="text-xs text-muted-foreground">
                            You&apos;ll be the admin of this new organization.
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                    <CardFooter>
                      <AsyncButton
                        className="w-full"
                        type="submit"
                        pendingText="Joining..."
                      >
                        Join organization
                      </AsyncButton>
                    </CardFooter>
                  </Card>
                </form>
              </FormProvider>
            )
          ) : null}

          {!user ? (
            <Card id="waitlist" className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-[0.2em]">
                  Join the waiting list
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  New to {appName}? Register your interest and we&apos;ll invite
                  your firm to onboard.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <WaitlistSignupForm />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthPageContent />
    </Suspense>
  );
}
