"use client";

import { useMemo } from "react";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FileInput, FileInputTrigger } from "../ui/file-input";
import { PageTitle } from "../page-title";
import { Button } from "../ui/button";
import { normalizeEvidenceGroup } from "@/lib/intake-evidence";

export function SupportingDocumentsView() {
  const {
    suggestedEvidence,
    evidenceFiles,
    statementFormalization,
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
        groupMap.set(group, "application/pdf,image/*,video/*,audio/*,.doc,.docx,.txt");
      }
    }

    if (!groupMap.has("other")) {
      groupMap.set("other", "application/pdf,image/*,video/*,audio/*,.doc,.docx,.txt");
    }

    return Array.from(groupMap.entries()).map(([name, type]) => ({
      name,
      type,
      files: evidenceFiles[name] ?? [],
    }));
  }, [evidenceFiles, suggestedGroups]);

  return (
    <div className="px-8 space-y-4">
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
          <Card key={group.name} size="md">
            <CardHeader className="pb-2">
              <CardTitle className="ml-1 flex items-center justify-between gap-3">
                <span>{group.name}</span>
                <FileInput
                  multiple
                  accept={group.type}
                  disabled={isBusy || hasConvoEnded}
                  onChange={(files) => void setEvidence(files, group.name)}
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-muted-foreground">{file.type}</p>
                        <p className="text-muted-foreground">
                          Added {new Date(file.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isBusy || hasConvoEnded}
                        onClick={() => void removeEvidence(file.path)}
                      >
                        Remove
                      </Button>
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
