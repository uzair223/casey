"use client";

import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WaitlistSignupSchema, WaitlistSignupSchemaType } from "@/lib/schema";

export function WaitlistSignupForm() {
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
        className="space-y-4"
        onSubmit={formMethods.handleSubmit(onSubmit)}
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="waitlist-name">Name</Label>
          <Input
            id="waitlist-name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            {...formMethods.register("name")}
          />
          {formMethods.formState.errors.name?.message ? (
            <p className="text-sm text-destructive">
              {formMethods.formState.errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="waitlist-company">Company Name</Label>
          <Input
            id="waitlist-company"
            type="text"
            placeholder="Acme Legal"
            {...formMethods.register("companyName")}
          />
          {formMethods.formState.errors.companyName?.message ? (
            <p className="text-sm text-destructive">
              {formMethods.formState.errors.companyName.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="waitlist-email">Email</Label>
          <Input
            id="waitlist-email"
            type="email"
            placeholder="name@firm.co.uk"
            autoComplete="email"
            {...formMethods.register("email")}
          />
          {formMethods.formState.errors.email?.message ? (
            <p className="text-sm text-destructive">
              {formMethods.formState.errors.email.message}
            </p>
          ) : null}
        </div>

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

        <AsyncButton className="w-full" type="submit" pendingText="Joining...">
          Join the waiting list
        </AsyncButton>
      </form>
    </FormProvider>
  );
}
