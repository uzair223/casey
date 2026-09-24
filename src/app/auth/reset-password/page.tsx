"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Loading from "@/components/loading";
import { AuthShell } from "@/components/auth-shell";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type RecoveryState = "loading" | "ready" | "invalid";

function buildRecoveryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/code verifier/i.test(message)) {
    return "This reset link only works in the browser that requested it. Request a new reset email and open that link.";
  }
  return message || "This password reset link is invalid or has expired.";
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recoveryParams = useMemo(
    () => ({
      code: searchParams.get("code"),
      tokenHash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
    }),
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    const establishRecoverySession = async () => {
      const supabase = getSupabaseClient();
      let verificationError: unknown = null;

      try {
        if (recoveryParams.tokenHash && recoveryParams.type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: recoveryParams.tokenHash,
            type: "recovery",
          });
          if (error) verificationError = error;
        } else if (recoveryParams.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            recoveryParams.code,
          );
          if (error) verificationError = error;
        } else if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#/, ""),
          );
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const hashType = hashParams.get("type");

          if (
            accessToken &&
            refreshToken &&
            (hashType === "recovery" || recoveryParams.type === "recovery")
          ) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) verificationError = error;
          }
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          throw (
            verificationError ?? error ?? new Error("Recovery session not found")
          );
        }

        if (!cancelled) {
          setRecoveryEmail(user.email ?? "");
          setRecoveryState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setRecoveryState("invalid");
          setRecoveryError(buildRecoveryErrorMessage(error));
        }
      }
    };

    void establishRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [recoveryParams]);

  const handleResetPassword = async (
    event?: React.FormEvent<HTMLFormElement>,
  ) => {
    event?.preventDefault();
    const password = newPassword.trim();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      toast.success("Your password has been reset.");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 800);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (recoveryState === "loading") {
    return <Loading />;
  }

  if (recoveryState === "invalid") {
    return (
      <section className="relative container min-h-screen py-6">
        <Card className="mx-auto max-w-2xl border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle className="text-2xl font-display">
              Reset link unavailable
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {recoveryError ||
                "This password reset link is invalid or has expired."}
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
      <form onSubmit={(event) => void handleResetPassword(event)}>
        <CardHeader>
          <p className="text-[14px] uppercase tracking-[0.15em] text-brand">
            Account
          </p>
          <CardTitle className="mt-2 font-display text-3xl font-normal tracking-tight text-primary">
            Reset your password
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Choose a new password for your account.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={recoveryEmail}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              name="new-password"
              autoComplete="new-password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <AsyncButton
            className="rounded-full"
            variant="brand"
            type="submit"
            pendingText="Resetting..."
            disabled={isSubmitting}
          >
            Reset password
          </AsyncButton>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/auth">Back to sign in</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loading />}>
        <ResetPasswordPageContent />
      </Suspense>
    </AuthShell>
  );
}
