"use client";

import { useWitnessStatement } from "@/components/intake/intake-context";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FileInput, FileInputList, FileInputTrigger } from "../ui/file-input";
import { PageTitle } from "../page-title";

export function SupportingDocumentsView() {
  const {
    suggestedEvidence,
    evidenceFiles,
    statementFormalization,
    isBusy,
    hasConvoEnded,
    setTab,
    setEvidence,
  } = useWitnessStatement();

  return (
    <div className="px-8 space-y-4">
      <PageTitle
        subtitle="Evidence"
        title="Supporting Documents"
        description="Upload your evidence and supporting files if needed."
        actions={[
          {
            label: "Prepare Statement",
            action: () => {
              setTab("statement");
              void statementFormalization.handler();
            },
            disabled: isBusy || hasConvoEnded,
          },
        ]}
      />

      <FileInput
        multiple
        accept={"application/pdf,image/*,video/*"}
        disabled={isBusy || hasConvoEnded}
        value={evidenceFiles["other"] || []}
        onChange={(files) => setEvidence(files, "other")}
      >
        <FileInputTrigger />
        <div className="mt-2 space-y-1.5">
          <FileInputList />
        </div>
      </FileInput>

      {/* Suggested Evidence from Previous Messages */}
      {suggestedEvidence && suggestedEvidence.length > 0 && (
        <>
          <p className="text-muted-foreground">
            Suggested evidence from your conversation
          </p>
          <div className="grid md:grid-cols-2 gap-2.5">
            {suggestedEvidence.map((file, idx) => (
              <FileInput
                asChild
                multiple
                accept={file.type}
                key={idx}
                disabled={isBusy || hasConvoEnded}
                value={evidenceFiles[file.name] || []}
                onChange={(files) => setEvidence(files, file.name)}
              >
                <Card size="md">
                  <CardHeader className="pb-2">
                    <CardTitle className="ml-1">
                      <span>{file.name}</span>
                      <span className="ml-4 text-muted-foreground text-sm font-normal">
                        ({file.type})
                      </span>
                    </CardTitle>
                    <FileInputTrigger />
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
