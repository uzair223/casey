"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Loading from "@/components/loading";
import { AuthShell } from "@/components/auth-shell";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isEmailLinkType } from "@/lib/utils";

function continuePath(inviteCode: string | null) {
  if (!inviteCode) return "/auth";
  const params = new URLSearchParams({ invite: inviteCode });
  return `/auth?${params.toString()}`;
}

function ConfirmLinkPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const link = useMemo(
    () => ({
      tokenHash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
      inviteCode: searchParams.get("invite"),
    }),
    [searchParams],
  );

  const linkIsValid = Boolean(link.tokenHash) && isEmailLinkType(link.type);

  const continueSignIn = async () => {
    if (!link.tokenHash || !isEmailLinkType(link.type)) {
      setErrorMessage("This sign-in link is invalid or has expired.");
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: link.tokenHash,
      type: link.type,
    });

    if (error) {
      setErrorMessage(
        error.message || "This sign-in link is invalid or has expired.",
      );
      return;
    }

    router.replace(continuePath(link.inviteCode));
  };

  if (!linkIsValid || errorMessage) {
    return (
      <section className="relative container min-h-screen py-6">
        <Card className="mx-auto max-w-2xl border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle className="text-2xl font-display">
              Sign-in link unavailable
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {errorMessage ||
                "This sign-in link is invalid or has expired. Request a new one from the sign-in page."}
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/auth">Return to sign in</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  return (
    <Card className="mx-auto max-w-lg rounded-2xl border-primary/10 bg-primary/[0.03] shadow-none">
      <CardHeader>
        <p className="text-[14px] uppercase tracking-[0.15em] text-brand">
          Account
        </p>
        <CardTitle className="mt-2 font-display text-3xl font-normal tracking-tight text-primary">
          Continue signing in
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Continue to open your account. The link is only used when you click.
        </p>
      </CardHeader>
      <CardFooter className="gap-2">
        <AsyncButton
          className="rounded-full"
          variant="brand"
          type="button"
          pendingText="Signing in..."
          onClick={continueSignIn}
        >
          Continue
        </AsyncButton>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/auth">Back to sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ConfirmLinkPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loading />}>
        <ConfirmLinkPageContent />
      </Suspense>
    </AuthShell>
  );
}
