"use client";

import { useEffect, useState } from "react";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InviteWithTenantName } from "@/lib/supabase/queries";
import { apiFetch, getAuthURL, getRoleLabel } from "@/lib/utils";

export default function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, isLoading: userLoading, refreshUser } = useUser();
  const [status, setStatus] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const [inviteInfo, setInviteInfo] = useState<InviteWithTenantName | null>(
    null,
  );

  const authForm = useForm<{ email: string }>({ defaultValues: { email: "" } });
  const lookupInviteForm = useForm<{ inviteCode: string }>({
    defaultValues: { inviteCode: "" },
  });
  const acceptInviteForm = useForm<{ displayName: string; firmName: string }>({
    defaultValues: { displayName: "", firmName: "" },
  });

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      setSessionToken(token);
    };
    init();
  }, []);

  // Redirect logic after loading completes
  useEffect(() => {
    if (!userLoading && user) {
      // Only proceed if user has accepted an invite (role is not "user")
      if (user.role === "user") {
        // User hasn't accepted an invite yet, stay on auth page
        return;
      }

      // User is fully set up, redirect to dashboard
      if (user.tenant_id || user.role === "app_admin") {
        router.replace("/dashboard");
      }
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    const inviteCode = searchParams.get("invite");
    if (inviteCode) {
      lookupInviteForm.setValue("inviteCode", inviteCode);
    }
  }, [searchParams]);

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

      setStatus(
        "Check your email for the magic link. It may take a minute to arrive. Be sure to check your spam folder!",
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send magic link";
      setStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleLookupInvite: SubmitHandler<{ inviteCode: string }> = async ({
    inviteCode,
  }) => {
    if (!inviteCode.trim()) {
      const error = "Invite code is required.";
      setStatus(error);
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
      setStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleAcceptInvite: SubmitHandler<{
    displayName: string;
    firmName: string;
  }> = async ({ displayName, firmName }) => {
    if (!inviteInfo || !sessionToken) {
      const error = "No invite information available.";
      setStatus(error);
      throw new Error(error);
    }

    if (!displayName.trim()) {
      const error = "Display name is required";
      setStatus(error);
      throw new Error(error);
    }

    const needsFirmName =
      inviteInfo.role === "tenant_admin" && !inviteInfo.tenant_id;
    if (needsFirmName && !firmName.trim()) {
      const error = "Firm name is required";
      setStatus(error);
      throw new Error(error);
    }

    try {
      const response = await fetch(`/api/invites/accept/${inviteInfo.token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          firmName: needsFirmName ? firmName.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept invite");
      }

      await refreshUser();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to accept invite";
      setStatus(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return (
    <section className="container mx-auto grid max-w-2xl gap-4 py-8">
      {!sessionToken ? (
        <Card>
          <CardHeader>
            <span className="text-xs uppercase tracking-[0.2em] text-accent-foreground mb-0">
              Get Started
            </span>
            <h1 className="text-2xl font-display">
              Sign into your Casey Portal
            </h1>
          </CardHeader>
          <FormProvider {...authForm}>
            <form onSubmit={authForm.handleSubmit(handleMagicLink)}>
              <CardContent>
                <div className="form-item">
                  <Input
                    type="email"
                    placeholder="name@firm.co.uk"
                    required
                    {...authForm.register("email")}
                  />
                  <Label htmlFor="email">Email</Label>
                </div>
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

      {sessionToken &&
      !userLoading &&
      user?.tenant_id === null &&
      user?.role !== "app_admin" ? (
        !inviteInfo ? (
          <FormProvider {...lookupInviteForm}>
            <form onSubmit={lookupInviteForm.handleSubmit(handleLookupInvite)}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-[0.2em]">
                    Join an organization
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="inviteCode">Invite code</Label>
                    <Input
                      placeholder="Paste invite code here"
                      {...lookupInviteForm.register("inviteCode")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sent via email or shared by your organization.
                    </p>
                  </div>
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
          <FormProvider {...acceptInviteForm}>
            <form onSubmit={acceptInviteForm.handleSubmit(handleAcceptInvite)}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-[0.2em]">
                    Join an organization
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
                <CardContent className="pt-4 border-t space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      type="text"
                      placeholder="John Smith"
                      required
                      {...acceptInviteForm.register("displayName")}
                    />
                  </div>

                  {inviteInfo.role === "tenant_admin" &&
                  !inviteInfo.tenant_id ? (
                    <div className="space-y-2">
                      <Label htmlFor="firmName">Firm Name</Label>
                      <Input
                        type="text"
                        placeholder="Your Law Firm Ltd"
                        required
                        {...acceptInviteForm.register("firmName")}
                      />
                      <p className="text-xs text-muted-foreground">
                        You'll be the admin of this new organization.
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

      {status ? (
        <Card size="md">
          <CardHeader className="text-sm">{status}</CardHeader>
        </Card>
      ) : null}
    </section>
  );
}
