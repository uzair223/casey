"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { Loader2 } from "lucide-react";
import { PageTitle } from "../page-title";
import { generateDoc } from "@/lib/doc-gen";
import { useAsync } from "@/hooks/useAsync";

const DocxEditor = dynamic(
  async () => (await import("@eigenpal/docx-js-editor")).DocxEditor,
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">
        Loading statement preview...
      </p>
    ),
  },
);

export function StatementView() {
  const {
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
      caseTitle: data.case.title,
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

  if (statementFormalization.isLoading) {
    return (
      <div className="px-8 py-12">
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
      <div className="px-8 space-y-8">
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
      <div className="px-8 space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Conversation complete
          </p>
          <h2 className="text-2xl font-semibold text-primary mt-2">
            Thank you for providing the details of the incident
          </h2>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Before generation, you will review the evidence list that will be
            included in your statement. Once confirmed, we will prepare your
            draft statement.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Button onClick={() => setTab("evidence")}>Review Evidence</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Statement {statementSubmission.data ? "submitted" : "prepared"}
          </p>
          <h2 className="text-2xl font-semibold text-primary mt-2">
            {statementSubmission.data
              ? "Thank you for your statement"
              : "Review your statement"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {statementSubmission.data
              ? "Your statement has been saved. The legal team will review it shortly."
              : "Please review your statement below and submit when ready."}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {!statementSubmission.data && (
            <Button
              onClick={statementSubmission.handler}
              disabled={
                statementSubmission.data || statementSubmission.isLoading
              }
            >
              {statementSubmission.isLoading
                ? "Submitting..."
                : "Submit Statement"}
            </Button>
          )}
        </div>
      </div>
      {doc ? (
        <div className="overflow-hidden rounded-md border bg-white">
          <DocxEditor
            documentBuffer={doc}
            documentName="Witness Statement"
            readOnly
            mode="viewing"
            showToolbar={false}
            showOutlineButton={false}
          />
        </div>
      ) : null}
    </div>
  );
}
