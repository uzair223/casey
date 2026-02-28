"use client";

import { useWitnessStatement } from "@/contexts/WitnessStatementContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FileInput, FileInputList, FileInputTrigger } from "../ui/file-input";

export function SupportingDocumentsView() {
  const {
    statementData,
    suggestedEvidence,
    evidenceFiles,
    setEvidence,
    isSubmitting,
    isSubmitted,
  } = useWitnessStatement();

  if (!statementData) return null;

  return (
    <div className="px-8 space-y-4">
      <div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Evidence
          </p>
          <h2 className="text-2xl font-semibold text-primary mt-2">
            Supporting Documents
          </h2>
          <p className="text-muted-foreground mt-2">
            Upload any supporting documents related to your case (receipts,
            medical reports, photos, dashcam footage, etc.).
          </p>
        </div>
      </div>

      <FileInput
        disabled={isSubmitting || isSubmitted}
        value={evidenceFiles["other"] || []}
        onChange={(files) => setEvidence(files, "other")}
      >
        <FileInputTrigger multiple accept={"application/pdf,image/*,video/*"} />
        <div className="mt-2 space-y-1.5">
          <FileInputList />
        </div>
      </FileInput>

      {/* Suggested Evidence from Previous Messages */}
      {suggestedEvidence && suggestedEvidence.length > 0 && (
        <>
          <p className="text-muted-foreground">
            Suggested evidence from your conversation:
          </p>
          <div className="grid md:grid-cols-2 gap-2.5">
            {suggestedEvidence.map((file, idx) => (
              <FileInput
                asChild
                key={idx}
                disabled={isSubmitting || isSubmitted}
                value={evidenceFiles[file.name] || []}
                onChange={(files) => setEvidence(files, file.name)}
              >
                <Card size="md" opacity={40}>
                  <CardHeader className="pb-2">
                    <CardTitle className="ml-1">
                      <span>{file.name}</span>
                      <span className="ml-4 text-muted-foreground text-sm font-normal">
                        ({file.type})
                      </span>
                    </CardTitle>
                    <FileInputTrigger multiple accept={file.type} />
                  </CardHeader>
                  <CardContent className="empty:hidden space-y-1.5">
                    <FileInputList />
                  </CardContent>
                </Card>
              </FileInput>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
