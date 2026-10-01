"use client";

import Link from "next/link";
import React from "react";

import { WitnessChat } from "@/components/witness-chat/witness-chat";
import { Button } from "@/components/ui/button";

export default function FollowUpPage({
  params,
}: {
  params: React.Usable<{ token: string }>;
}) {
  const { token } = React.use(params);

  return (
    <section className="container space-y-4 py-4 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <WitnessChat mode="witness" token={token} />
        <div className="mt-3">
          <Button asChild variant="outline">
            <Link href={`/intake/${token}/interview`}>Open interview page</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
