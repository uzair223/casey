"use client";

import { useMemo } from "react";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FileInput, FileInputTrigger } from "../ui/file-input";
import { PageTitle } from "../page-title";
import { Button } from "../ui/button";
import { normalizeEvidenceGroup } from "@/lib/evidence";
import { AttachmentPreviewCard } from "../ui/attachment-preview-card";

export function SupportingDocumentsView() {
  const {
    suggestedEvidence,
    evidenceFiles,
    statementFormalization,
    isDemo,
    isBusy,
    hasConvoEnded,
    setTab,
    setEvidence,
    removeEvidence,
  } = useWitnessStatement();

  const suggestedGroups = useMemo(
    () =>
      (suggestedEvidence ?? []).map((item) => ({
        name: normalizeEvidenceGroup(item.name),
        type: item.type,
      })),
    [suggestedEvidence],
  );

  const knownGroups = useMemo(() => {
    const groupMap = new Map<string, string>();

    for (const item of suggestedGroups) {
      groupMap.set(item.name, item.type);
    }

    for (const group of Object.keys(evidenceFiles)) {
      if (!groupMap.has(group)) {
        groupMap.set(
          group,
          "application/pdf,image/*,video/*,audio/*,.doc,.docx,.txt",
        );
      }
    }

    if (!groupMap.has("other")) {
      groupMap.set(
        "other",
        "application/pdf,image/*,video/*,audio/*,.doc,.docx,.txt",
      );
    }

    return Array.from(groupMap.entries()).map(([name, type]) => ({
      name,
      type,
      files: evidenceFiles[name] ?? [],
    }));
  }, [evidenceFiles, suggestedGroups]);

  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8">
      <PageTitle
        subtitle="Evidence"
        title="Supporting Documents"
        description="Files added in chat are saved here under evidence groups. You can add or remove documents before preparing the statement."
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

      <div className="grid gap-2.5 md:grid-cols-2">
        {knownGroups.map((group) => (
          <Card key={group.name}>
            <CardHeader>
              <CardTitle className="flex flex-col items-start gap-3 sm:ml-1 sm:flex-row sm:items-center sm:justify-between">
                <span>{group.name}</span>
                <FileInput
                  multiple
                  accept={group.type}
                  disabled={isDemo || isBusy || hasConvoEnded}
                  onChange={
                    isDemo
                      ? undefined
                      : (files) => void setEvidence(files, group.name)
                  }
                >
                  <FileInputTrigger variant="outline">
                    Add files
                  </FileInputTrigger>
                </FileInput>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No files added yet.
                </p>
              ) : (
                group.files.map((file) => (
                  <div
                    key={file.path}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <AttachmentPreviewCard
                          document={file}
                          hideLabel="all"
                          thumbnailSize="lg"
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="truncate text-muted-foreground">
                            {file.type}
                          </p>
                          <p className="text-muted-foreground">
                            Added {new Date(file.uploadedAt).toLocaleString()}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            disabled={isDemo || isBusy || hasConvoEnded}
                            onClick={
                              isDemo
                                ? undefined
                                : () => void removeEvidence(file.path)
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
