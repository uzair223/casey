"use client";
import { env } from "@/lib/env";
import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IntakeProvider,
  IntakeTabs,
  useWitnessStatement,
} from "@/components/intake/intake-context";
import { ChatAreaContent, ChatAreaFooter } from "@/components/intake/chat-area";
import { SupportingDocumentsView } from "@/components/intake/supporting-docs";
import { StatementView } from "@/components/intake/statement-view";
import { PageHeader } from "@/components/intake/page-header";
import { SecurityNotice } from "@/components/intake/security-notice";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";

function StatementContent() {
  const {
    tab,
    setTab,
    isDemo,
    isDemoTabsUnlocked,
    isReadyToPrepare,
    statementSubmission,
    acknowledgePrivacyNotice,
    hasAcknowledgedPrivacyNotice,
  } = useWitnessStatement();
  const [consentChecked, setConsentChecked] = React.useState(false);

  useEffect(() => {
    if (isDemo && !isDemoTabsUnlocked && tab !== "chat") {
      setTab("chat");
    }
  }, [isDemo, isDemoTabsUnlocked, tab, setTab]);

  const tabs = [
    {
      id: "chat" as IntakeTabs,
      label: "Chat",
      main: <ChatAreaContent />,
      footer: <ChatAreaFooter />,
    },
    {
      id: "evidence" as IntakeTabs,
      label: "Evidence Confirmation",
      disabled: (isDemo && !isDemoTabsUnlocked) || !isReadyToPrepare,
      main: <SupportingDocumentsView />,
    },
    {
      id: "statement" as IntakeTabs,
      label: statementSubmission.data
        ? "Statement Submitted"
        : "Statement Preview",
      disabled: (isDemo && !isDemoTabsUnlocked) || !isReadyToPrepare,
      main: <StatementView />,
    },
  ];

  if (!hasAcknowledgedPrivacyNotice) {
    return (
      <section className="container flex min-h-svh items-center justify-center py-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <h1 className="text-2xl font-semibold">
              Privacy and UK GDPR Notice
            </h1>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Before starting, please review this notice. Your responses are
              processed for witness statement preparation for a UK legal matter.
              The law firm acts as controller for case handling, and{" "}
              {env.NEXT_PUBLIC_APP_NAME}
              processes data on their instructions.
            </p>
            <p>
              Data is handled with access controls and audit logging and is used
              only for legal service delivery and compliance obligations.
            </p>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <input
                id="privacy-consent"
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <Label htmlFor="privacy-consent">
                I have read and accept the privacy notice.
              </Label>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              disabled={!consentChecked || acknowledgePrivacyNotice.isLoading}
              onClick={acknowledgePrivacyNotice.handler}
            >
              {acknowledgePrivacyNotice.isLoading ? "Saving..." : "Continue"}
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  return (
    <section className="container flex min-h-svh max-h-svh overflow-hidden flex-col gap-4 py-6">
      <PageHeader />
      <SecurityNotice />

      <Tabs
        asChild
        value={tab}
        onValueChange={setTab as (value: string) => void}
        defaultValue={isDemo ? "chat" : isReadyToPrepare ? "statement" : "chat"}
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

export default function StatementInterviewPage({
  params,
}: {
  params: React.Usable<{ token: string }>;
}) {
  const { token } = React.use(params);

  return (
    <IntakeProvider token={token}>
      <StatementContent />
    </IntakeProvider>
  );
}
