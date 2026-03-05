"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { WaitlistSignupForm } from "@/components/waitlist/WaitlistSignupForm";

export default function Home() {
  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Secure witness intake
          </p>
          <h1 className="font-display max-w-2xl text-4xl text-primary sm:text-5xl">
            Build reliable witness statements with an AI-guided workflow.
          </h1>
        </CardHeader>
        <CardContent>
          <CardDescription className="max-w-xl">
            This MVP demonstrates a secure intake flow for personal injury
            firms. Create cases, send a magic link, and guide witnesses through
            structured, non-leading prompts.
          </CardDescription>
        </CardContent>

        <CardFooter>
          <Button asChild>
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/statement/demo">Preview witness flow</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="#waitlist">Join the waiting list</Link>
          </Button>
        </CardFooter>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Structured intake",
            body: "Collect timelines, locations, injuries, and evidence with guided prompts.",
          },
          {
            title: "Magic links",
            body: "Issue time-limited links for each witness, ready for SMS or email delivery.",
          },
          {
            title: "AI follow-up skeleton",
            body: "Detect vague answers and ask neutral clarifying questions before submission.",
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader className="pb-2">
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{item.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="w-full max-w-2xl mx-auto" id="waitlist">
        <CardHeader>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Early access
          </p>
          <CardTitle>Join the waiting list</CardTitle>
          <CardDescription>
            Register your interest and we'll invite you to onboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WaitlistSignupForm />
        </CardContent>
      </Card>
    </section>
  );
}
