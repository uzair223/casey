"use client";

import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { RhfField } from "@/components/ui/rhf-field";
import { WaitlistSignupSchema, WaitlistSignupSchemaType } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import Link from "next/link";
import { env } from "@/lib/env";

export function WaitlistSignupForm({
  className,
  disableCalendly,
  ...props
}: Exclude<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  disableCalendly?: boolean;
}) {
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const formMethods = useForm<WaitlistSignupSchemaType>({
    resolver: zodResolver(WaitlistSignupSchema),
    defaultValues: {
      name: "",
      companyName: "",
      email: "",
    },
  });

  const onSubmit: SubmitHandler<WaitlistSignupSchemaType> = async (values) => {
    setFeedback(null);

    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      const message = payload.error || "Unable to join waitlist right now.";
      setFeedback({ type: "error", message });
      throw new Error(message);
    }

    formMethods.reset();
    setFeedback({
      type: "success",
      message:
        payload.message || "You are on the waitlist. We will be in touch.",
    });
  };

  return (
    <FormProvider {...formMethods}>
      <form
        className={cn("space-y-4", className)}
        onSubmit={formMethods.handleSubmit(onSubmit)}
        noValidate
        {...props}
      >
        <RhfField
          form={formMethods}
          name="name"
          controlId="waitlist-name"
          label="Name"
          registerOptions={{ required: true }}
          renderControl={(registration, required) => (
            <Input
              id="waitlist-name"
              type="text"
              placeholder="Jane Doe"
              autoComplete="name"
              required={required}
              {...registration}
            />
          )}
        />

        <RhfField
          form={formMethods}
          name="companyName"
          controlId="waitlist-company"
          label="Company Name"
          registerOptions={{ required: true }}
          renderControl={(registration, required) => (
            <Input
              id="waitlist-company"
              type="text"
              placeholder="Acme Legal"
              required={required}
              {...registration}
            />
          )}
        />

        <RhfField
          form={formMethods}
          name="email"
          controlId="waitlist-email"
          label="Email"
          registerOptions={{ required: true }}
          renderControl={(registration, required) => (
            <Input
              id="waitlist-email"
              type="email"
              placeholder="name@firm.co.uk"
              autoComplete="email"
              required={required}
              {...registration}
            />
          )}
        />

        {feedback ? (
          <p
            className={`text-sm ${
              feedback.type === "success"
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <AsyncButton
            className="w-full"
            type="submit"
            pendingText="Joining..."
          >
            Join the waiting list
          </AsyncButton>
          {!disableCalendly && env.NEXT_PUBLIC_CALENDLY_LINK && (
            <>
              <span className="text-xs text-center text-muted-foreground">
                &mdash; or &mdash;
              </span>
              <Button className="w-full" variant="outline" asChild>
                <Link
                  href={env.NEXT_PUBLIC_CALENDLY_LINK}
                  target="_blank"
                  rel="noreferrer"
                >
                  Book a demo call
                </Link>
              </Button>
            </>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
