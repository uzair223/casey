"use client";

import { Button } from "@/components/ui/button";
import { useStatement } from "@/contexts/StatementContext";
import { StatementDocument } from "./StatementDocument";
import { SignaturePad } from "./SignaturePad";
import { Loader2 } from "lucide-react";

export function StatementView() {
  const {
    statementData,
    isSigned,
    handleCaptureSignature,
    isReadyToPrepare: isreadyToPrepare,
    isPreparing,
    isPrepared,
    isSubmitting,
    isDemo,
    isSubmitted,
    preparationError,
    handlePrepareStatement,
    handleSubmitStatement,
  } = useStatement();

  if (!statementData) return null;

  if (isPreparing) {
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

  if (preparationError) {
    return (
      <div className="px-8 space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Error
          </p>
          <h2 className="text-2xl font-semibold text-primary mt-2">
            There was an issue preparing your statement
          </h2>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Unfortunately, there was an unexpected error while preparing your
            statement. Please try again. If the issue persists, contact support
            for assistance.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Button onClick={handlePrepareStatement}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (isreadyToPrepare && !isPrepared) {
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
            Click the button to start preparing your statement based on the
            information you've provided. This may take a few moments. Once
            ready, you can review and submit your statement.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Button onClick={handlePrepareStatement}>Prepare Statement</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Statement {isSubmitted ? "submitted" : "prepared"}
          </p>
          <h2 className="text-2xl font-semibold text-primary mt-2">
            {isSubmitted
              ? "Thank you for your statement"
              : "Review your statement"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {isSubmitted
              ? "Your statement has been saved. The legal team will review it shortly."
              : "Please review your statement below and submit when ready."}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {!isSubmitted && (
            <Button
              onClick={isDemo ? undefined : handleSubmitStatement}
              disabled={isDemo || isSubmitting || isPreparing || !isSigned}
              title={!isSigned ? "Please sign the statement first" : ""}
            >
              {isSubmitting ? "Submitting..." : "Submit Statement"}
            </Button>
          )}
        </div>
      </div>
      <StatementDocument />
      {!isSigned && (
        <SignaturePad
          onSignatureCapture={handleCaptureSignature}
          witnessName={statementData.witness_name}
          isDisabled={false}
        />
      )}
    </div>
  );
}
