"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WitnessStatementProvider,
  useWitnessStatement,
} from "@/contexts/WitnessStatementContext";
import {
  ChatAreaContent,
  ChatAreaFooter,
} from "@/components/witness-statement/ChatArea";
import { SupportingDocumentsView } from "@/components/witness-statement/SupportingDocumentsView";
import { StatementView } from "@/components/witness-statement/StatementView";
import { PageHeader } from "@/components/witness-statement/PageHeader";
import { SecurityNotice } from "@/components/witness-statement/SecurityNotice";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";

function StatementContent() {
  const {
    tab,
    setTab,
    statementData,
    isLoadingData,
    loadError,
    isReadyToPrepare,
    isSubmitted,
  } = useWitnessStatement();

  if (isLoadingData) {
    return (
      <section className="flex flex-col justify-center items-center h-screen">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-8 w-64 bg-muted rounded mx-auto"></div>
          <div className="h-4 w-48 bg-muted rounded mx-auto"></div>
        </div>
      </section>
    );
  }

  // Handle other errors
  if (loadError || !statementData) {
    return (
      <section className="flex flex-col justify-center items-center h-screen space-y-4 px-4">
        <div className="text-muted-foreground text-6xl mb-2">🔒</div>
        <h1 className="text-3xl font-semibold">Link Not Available</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This magic link is invalid, or has expired.
        </p>
        <p className="text-sm text-muted-foreground">
          Please contact the law firm for a new link.
        </p>
        <Button asChild variant="link">
          <Link href="/">Return to home</Link>
        </Button>
      </section>
    );
  }

  const tabs = [
    {
      id: "chat" as const,
      label: "Chat",
      main: <ChatAreaContent />,
      footer: <ChatAreaFooter />,
    },
    {
      id: "documents" as const,
      label: "Supporting Documents",
      disabled: !isReadyToPrepare,
      main: <SupportingDocumentsView />,
    },
    {
      id: "statement" as const,
      label: isSubmitted ? "Statement Submitted" : "Statement Preview",
      disabled: !isReadyToPrepare,
      main: <StatementView />,
    },
  ];

  return (
    <section className="container flex min-h-svh max-h-svh overflow-hidden flex-col gap-4 py-6">
      <PageHeader />
      <SecurityNotice />

      <Tabs
        asChild
        value={tab}
        onValueChange={setTab}
        defaultValue={isSubmitted || isReadyToPrepare ? "statement" : "chat"}
      >
        <ScrollAreaPrimitive.ScrollArea asChild>
          <Card size="md" className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="py-0">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={tab.disabled}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardHeader>
            {tabs.map((tab) => (
              <TabsContent
                className="flex min-h-0 flex-1 flex-col"
                key={tab.id}
                value={tab.id}
              >
                <ScrollAreaPrimitive.ScrollAreaViewport className="flex-1 overflow-y-auto overflow-x-hidden">
                  <CardContent className="pt-4">
                    {tab.main}
                    <ScrollBar />
                  </CardContent>
                </ScrollAreaPrimitive.ScrollAreaViewport>
                <CardFooter>{tab.footer}</CardFooter>
              </TabsContent>
            ))}
          </Card>
        </ScrollAreaPrimitive.ScrollArea>
      </Tabs>
    </section>
  );
}

export default function StatementPage({
  params,
}: {
  params: React.Usable<{ token: string }>;
}) {
  const { token } = React.use(params);

  return (
    <WitnessStatementProvider token={token}>
      <StatementContent />
    </WitnessStatementProvider>
  );
}
