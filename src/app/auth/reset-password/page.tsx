"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Loading from "@/components/loading";
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
import { getSupabaseClient } from "@/lib/supabase/client";

type RecoveryState = "loading" | "ready" | "invalid";

function buildRecoveryErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "This password reset link is invalid or has expired.";
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
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

      try {
        if (recoveryParams.tokenHash && recoveryParams.type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: recoveryParams.tokenHash,
            type: "recovery",
          });

          if (error) {
            throw error;
          }
        } else if (recoveryParams.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            recoveryParams.code,
          );

          if (error) {
            throw error;
          }
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

            if (error) {
              throw error;
            }
          }
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          throw error ?? new Error("Recovery session not found");
        }

        if (!cancelled) {
          setRecoveryState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setRecoveryState("invalid");
          setStatus({
            type: "error",
            message: buildRecoveryErrorMessage(error),
          });
        }
      }
    };

    void establishRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [recoveryParams]);

  const handleResetPassword = async () => {
    setStatus(null);

    const password = newPassword.trim();
    if (password.length < 8) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters long.",
      });
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

      setStatus({
        type: "success",
        message: "Your password has been reset.",
      });

      setTimeout(() => {
        router.replace("/dashboard");
      }, 800);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to reset password.",
      });
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
              {status?.message ||
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
    <section className="relative container min-h-screen py-6">
      <Card className="mx-auto max-w-2xl border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle className="text-2xl font-display">
            Reset your password
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </CardContent>
        <CardFooter className="gap-2">
          <AsyncButton
            onClick={handleResetPassword}
            pendingText="Resetting..."
            disabled={isSubmitting}
          >
            Reset password
          </AsyncButton>
          <Button asChild variant="outline">
            <Link href="/auth">Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
      {status ? (
        <Card
          size="md"
          variant={status.type === "error" ? "destructive" : "secondary"}
        >
          <CardHeader>
            <CardTitle className="text-sm">{status.message}</CardTitle>
          </CardHeader>
        </Card>
      ) : null}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
