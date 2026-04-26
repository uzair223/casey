"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { BellIcon, Loader2 } from "lucide-react";
import { PageTitle } from "../page-title";
import { generateDoc } from "@/lib/doc-gen";
import { useAsync } from "@/hooks/useAsync";
import { Card, CardHeader } from "../ui/card";
import { DocxEditor, DocxEditorPanel } from "../ui/docx-editor";

export function StatementView() {
  const router = useRouter();
  const {
    token,
    isDemo,
    data,
    statementSections,
    templateDocument,
    isReadyToPrepare,
    statementSubmission,
    statementFormalization,
    setTab,
  } = useWitnessStatement();

  const docPayload = useMemo(
    () => ({
      caseMetadata:
        (data.case.case_metadata as Record<
          string,
          string | number | null | undefined
        >) ?? {},
      witnessName: data.statement.witness_name,
      witnessEmail: data.statement.witness_email,
      witnessMetadata:
        (data.statement.witness_metadata as Record<
          string,
          string | number | null | undefined
        >) ?? {},
      sections: statementSections,
      config: data.statement.statement_config,
    }),
    [data, statementSections],
  );

  const { data: doc } = useAsync(
    async () =>
      templateDocument ? await generateDoc(docPayload, templateDocument) : null,
    [data, statementSections, templateDocument],
  );

  useEffect(() => {
    if (!statementSubmission.data) return;

    const defaults = {
      spread: 65,
      startVelocity: 45,
      gravity: 0.9,
      ticks: 220,
      scalar: 0.95,
      zIndex: 2000,
      colors: ["#22c55e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6"],
    };

    confetti({
      ...defaults,
      particleCount: 120,
      origin: { x: 0.5, y: 0.2 },
    });

    const followUp = setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 70,
        origin: { x: 0.25, y: 0.25 },
      });
      confetti({
        ...defaults,
        particleCount: 70,
        origin: { x: 0.75, y: 0.25 },
      });
    }, 350);

    return () => clearTimeout(followUp);
  }, [statementSubmission.data]);

  const [showDemoReviewedNotice, setShowDemoReviewedNotice] = useState(false);

  useEffect(() => {
    if (!isDemo || !statementSubmission.data || showDemoReviewedNotice) {
      return;
    }

    const notifyTimeout = setTimeout(() => {
      setShowDemoReviewedNotice(true);
    }, 2000);

    return () => {
      clearTimeout(notifyTimeout);
    };
  }, [isDemo, showDemoReviewedNotice, statementSubmission.data]);

  if (statementFormalization.isLoading) {
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Preparing your statement. This may take a moment...
          </p>
        </div>
      </div>
    );
  }

  if (statementFormalization.error) {
    return (
      <div className="space-y-8 px-4 sm:px-6 lg:px-8">
        <PageTitle
          subtitle="Error"
          title="There was an issue preparing your statement"
          description={
            <>
              Unfortunately, there was an unexpected error while preparing your
              statement. Please try again. If the issue persists, contact
              support for assistance.
            </>
          }
        />
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Button onClick={statementFormalization.handler}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (
    isReadyToPrepare &&
    !statementFormalization.data &&
    !statementSubmission.data
  ) {
    return (
      <div className="space-y-8 px-4 sm:px-6 lg:px-8">
        <PageTitle
          subtitle="Conversation complete"
          title="Thank you for providing the details of the incident"
          description="Before generation, you will review the evidence list that will be included in your statement. Once confirmed, we will prepare your draft statement."
          titleTag="h2"
        />
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Button onClick={() => setTab("evidence")}>Review Evidence</Button>
        </div>
      </div>
    );
  }

  return (
    <DocxEditor documentName="Witness Statement" source={doc} canEdit={false}>
      <div className="flex h-full max-h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 sm:px-6 lg:px-8">
        {statementSubmission.data ? (
          <PageTitle
            subtitle="Statement submitted"
            title="Thank you for your statement"
            description="Your statement has been saved. The legal team will review it shortly."
          />
        ) : (
          <PageTitle
            subtitle="Statement prepared"
            title="Review your statement"
            description="Please review your statement below and submit when ready."
            actions={
              !statementSubmission.data
                ? [
                    {
                      label: statementSubmission.isLoading
                        ? "Submitting..."
                        : "Submit Statement",
                      action: () => void statementSubmission.handler(),

                      disabled:
                        statementSubmission.data ||
                        statementSubmission.isLoading,
                    },
                  ]
                : undefined
            }
          />
        )}

        {doc ? (
          <DocxEditorPanel
            className="min-h-0 flex-1 basis-0 overflow-hidden"
            mode="bare"
          />
        ) : null}
      </div>

      {showDemoReviewedNotice ? (
        <Card
          size="md"
          variant="secondary"
          className="fixed right-4 top-4 z-50 w-[min(92vw,420px)] shadow-lg fade-in slide-in-from-right [--card-opacity:100%]"
        >
          <CardHeader className="flex-row items-start gap-2">
            <BellIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-sm space-y-2">
              <p>Your statement has been reviewed by the legal team.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/intake/${token}/final-review`)}
              >
                Sign off on your statement
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}
    </DocxEditor>
  );
}
