"use client";
import { env } from "@/lib/env";
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
import { getRoleLabel } from "@/lib/utils";
import { WaitlistSignupForm } from "@/components/waitlist/waitlist-form";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronUp,
  MailCheck,
  ShieldCheck,
} from "@/components/icons";
import Loading from "@/components/loading";
import { AuthShell } from "@/components/auth-shell";
import { toast } from "@/lib/toast";

function AuthPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user, isLoading: isUserLoading, refreshUser } = useUser();
  const [tenantLifecycle, setTenantLifecycle] = useState<{
    exists: boolean;
    softDeleted: boolean;
    name?: string;
    softDeletedAt?: string | null;
    softDeletedByRole?: string | null;
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
        "Organisation closed and you have been signed out. Sign in again before the retention period ends to restore access.",
      );

      const params = new URLSearchParams(searchParams.toString());
      params.delete("tenantClosed");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }, [searchParams, router, pathname]);

  const setErrorStatus = (message: string) => {
    toast.error(message);
  };

  const setSuccessStatus = (message: string) => {
    toast.success(message);
  };

  const [isPasswordDropdownOpen, setIsPasswordDropdownOpen] = useState(false);

  const authForm = useForm<{ email: string; password: string }>({
    defaultValues: { email: "", password: "" },
  });
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
      softDeletedByRole?: string | null;
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

  const willRedirect =
    !isUserLoading &&
    !isCheckingLifecycle &&
    user &&
    user.role !== "user" &&
    !tenantLifecycle?.softDeleted &&
    (user.tenant_id || user.role === "app_admin");

  if (
    isUserLoading ||
    (user?.tenant_id && isCheckingLifecycle) ||
    willRedirect
  ) {
    return <Loading />;
  }

  const sendMagicLink = async (email: string) => {
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          inviteCode: lookupInviteForm.getValues("inviteCode") || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send magic link");
      }

      setSuccessStatus(
        "Check your email for the sign-in link.",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send magic link";
      setErrorStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleMagicLink: SubmitHandler<{
    email: string;
    password: string;
  }> = async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (isPasswordDropdownOpen) {
        if (!password.trim()) {
          throw new Error("Password is required to login");
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          throw error;
        }

        await refreshUser();
        setSuccessStatus("Signed in successfully.");
        return;
      }

      await sendMagicLink(normalizedEmail);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to sign in";
      setErrorStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleForgotPassword = async () => {
    try {
      const email = authForm.getValues("email").trim().toLowerCase();
      if (!email) {
        throw new Error("Enter your email first to reset your password");
      }

      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ email }),
      });

      setSuccessStatus(
        "If a password login exists for this account, a reset email has been sent.",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send reset email";
      setErrorStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleLookupInvite: SubmitHandler<{ inviteCode: string }> = async ({
    inviteCode,
  }) => {
    try {
      if (!inviteCode.trim()) {
        throw new Error("Invite code is required.");
      }
      const token = inviteCode.trim();

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
    try {
      if (!inviteInfo) {
        throw new Error("No invite information available.");
      }

      if (!displayName.trim()) {
        throw new Error("Display name is required");
      }

      const needsFirmName =
        inviteInfo.role === "tenant_admin" && !inviteInfo.tenant_id;
      if (needsFirmName && !firmName.trim()) {
        throw new Error("Firm name is required");
      }
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
              softDeletedByRole: null,
              purgeAfter: null,
            }
          : prev,
      );
      router.replace("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to restore organisation";
      setErrorStatus(message);
      throw new Error(message);
    }
  };

  return (
    <div className="grid gap-12 md:grid-cols-[0.95fr_1.05fr] md:items-start lg:gap-16">
        <aside className="max-md:order-last">
          <p className="text-[14px] uppercase tracking-[0.15em] text-brand">
            Sign in
          </p>
          <h1 className="mt-2 max-w-[14ch] font-display text-4xl leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Sign in and get back to the lead.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-muted-foreground">
            Magic-link access for legal teams. Join a firm workspace, then pick
            up the enquiry instead of another chase.
          </p>

          <div className="mt-10 space-y-3">
            {[
              {
                icon: MailCheck,
                title: "Magic link first",
                body: "Use your work email. Password is optional.",
              },
              {
                icon: Building2,
                title: "Firm workspace",
                body: "Join an existing firm or set up a new one.",
              },
              {
                icon: ShieldCheck,
                title: "Review with a trail",
                body: "Facts, evidence, and notes stay firm-isolated and auditable.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <item.icon className="h-4 w-4 text-brand" />
                  {item.title}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/10 px-3 py-1">
              <BadgeCheck className="h-3.5 w-3.5 text-brand" />
              UK claimant firms
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/10 px-3 py-1">
              <BadgeCheck className="h-3.5 w-3.5 text-brand" />
              Invite-led access control
            </span>
          </div>
        </aside>

        <div className="space-y-6">
          {!user ? (
            <Card className="rounded-2xl border-primary/10 bg-primary/[0.03] shadow-none">
              <CardHeader>
                <span className="mb-0 text-[14px] uppercase tracking-[0.15em] text-brand">
                  Step 1
                </span>
                <h2 className="font-display text-2xl text-primary">
                  Secure sign-in
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Magic links are recommended. Open the password dropdown if you
                  prefer password login.
                </p>
              </CardHeader>
              <FormProvider {...authForm}>
                <form onSubmit={authForm.handleSubmit(handleMagicLink)}>
                  <CardContent className="space-y-4">
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
                          autoComplete="username"
                          placeholder="name@firm.co.uk"
                          required={required}
                          {...registration}
                        />
                      )}
                    />

                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
                      onClick={() => {
                        setIsPasswordDropdownOpen((prev) => !prev);
                        authForm.setValue("password", "");
                      }}
                      aria-expanded={isPasswordDropdownOpen}
                      aria-controls="auth-password-dropdown"
                    >
                      <span className="h-px flex-1 bg-border" />
                      <span>Password</span>
                      {isPasswordDropdownOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      <span className="h-px flex-1 bg-border" />
                    </button>

                    <div
                      id="auth-password-dropdown"
                      className={
                        isPasswordDropdownOpen ? "space-y-2" : "sr-only"
                      }
                      inert={!isPasswordDropdownOpen ? true : undefined}
                    >
                      <RhfField
                        form={authForm}
                        name="password"
                        controlId="auth-password"
                        label="Password"
                        registerOptions={{
                          required: isPasswordDropdownOpen,
                        }}
                        renderControl={(registration, required) => (
                          <Input
                            id="auth-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="********"
                            required={required}
                            tabIndex={isPasswordDropdownOpen ? undefined : -1}
                            {...registration}
                          />
                        )}
                      />
                      <AsyncButton
                        type="button"
                        variant="ghost"
                        className="h-auto px-0 py-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
                        onClick={handleForgotPassword}
                        pendingText="Sending reset email..."
                        tabIndex={isPasswordDropdownOpen ? undefined : -1}
                      >
                        Forgot password?
                      </AsyncButton>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <AsyncButton
                      className="w-full rounded-full"
                      variant="brand"
                      type="submit"
                      pendingText={
                        isPasswordDropdownOpen ? "Logging in..." : "Sending..."
                      }
                    >
                      {isPasswordDropdownOpen ? "Login" : "Send magic link"}
                    </AsyncButton>
                  </CardFooter>
                </form>
              </FormProvider>
            </Card>
          ) : null}

          {user && tenantLifecycle ? (
            <Card variant="warning" className="rounded-2xl shadow-none">
              <CardHeader>
                <CardTitle className="text-[14px] uppercase tracking-[0.15em]">
                  Organisation archived
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tenantLifecycle.name || "Your organisation"} has been
                  archived. Data access is currently blocked.
                </p>
                <p className="text-xs text-muted-foreground">
                  Permanent deletion date:{" "}
                  {tenantLifecycle.purgeAfter || "unknown"}
                </p>
              </CardHeader>
              {tenantLifecycle.canRestore ? (
                <CardFooter>
                  <AsyncButton
                    className="w-full rounded-full"
                    variant="brand"
                    onClick={handleRestoreTenant}
                    pendingText="Restoring..."
                  >
                    Restore organisation
                  </AsyncButton>
                </CardFooter>
              ) : (
                <CardFooter>
                  <p className="text-sm text-muted-foreground">
                    Contact your app admin to restore access.
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
                  <Card className="rounded-2xl border-primary/10 bg-primary/[0.03] shadow-none">
                    <CardHeader>
                      <CardTitle className="text-[14px] uppercase tracking-[0.15em] text-brand">
                        Step 2: Join your firm workspace
                      </CardTitle>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Enter the invite code sent by your firm admin.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2 border-t border-primary/10 pt-4">
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
                        className="w-full rounded-full"
                        type="submit"
                        variant="brand"
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
                  <Card className="rounded-2xl border-primary/10 bg-primary/[0.03] shadow-none">
                    <CardHeader>
                      <CardTitle className="text-[14px] uppercase tracking-[0.15em] text-brand">
                        Step 3: Confirm access
                      </CardTitle>
                      {inviteInfo.tenant_id ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            You have been invited to join this firm
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
                    <CardContent className="space-y-4 border-t border-primary/10 pt-4">
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
                            You&apos;ll be the firm admin for this new
                            organisation.
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                    <CardFooter>
                      <AsyncButton
                        className="w-full rounded-full"
                        variant="brand"
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
            <Card
              id="waitlist"
              className="rounded-2xl border-primary/10 bg-primary/[0.03] shadow-none"
            >
              <CardHeader>
                <CardTitle className="text-[14px] uppercase tracking-[0.15em] text-brand">
                  Join the waiting list
                </CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  New to {env.NEXT_PUBLIC_APP_NAME}? Register your interest and
                  we&apos;ll invite your firm to onboard.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <WaitlistSignupForm />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
  );
}

export default function AuthPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loading />}>
        <AuthPageContent />
      </Suspense>
    </AuthShell>
  );
}
