"use client";

import { useStatementTemplateSettings } from "./context";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";

import { CodeDiffEditor, CodeEditor } from "@/components/ui/code-editor";

export function StatementTemplateJsonView() {
  const {
    advancedJson,
    applyAdvancedJson,
    draftConfig,
    pendingAiPatch,
    pendingAiPatchPaths,
    applyPendingAiPatch,
    discardPendingAiPatch,
  } = useStatementTemplateSettings();

  const [draftValue, setDraftValue] = useState(advancedJson);

  useEffect(() => {
    setDraftValue(advancedJson);
  }, [advancedJson]);

  const currentJson = useMemo(
    () => JSON.stringify(draftConfig, null, 2),
    [draftConfig],
  );

  const proposedJson = useMemo(() => {
    if (!pendingAiPatch) return null;
    return JSON.stringify(
      {
        ...draftConfig,
        ...pendingAiPatch,
      },
      null,
      2,
    );
  }, [draftConfig, pendingAiPatch]);

  const applyButton = (
    <AsyncButton
      onClick={async () => {
        await applyAdvancedJson(draftValue);
      }}
      pendingText="Applying..."
    >
      Apply JSON
    </AsyncButton>
  );

  return (
    <div className="space-y-4">
      {pendingAiPatchPaths.length > 0 && pendingAiPatch ? (
        <CodeDiffEditor
          mode="json"
          className="h-[65vh]"
          original={currentJson}
          modified={proposedJson ?? undefined}
        />
      ) : (
        <CodeEditor
          mode="json"
          className="h-[65vh]"
          value={draftValue}
          onChange={(val) => setDraftValue(val)}
        />
      )}

      {pendingAiPatchPaths.length > 0 ? (
        <div className="flex gap-2">
          <Button onClick={applyPendingAiPatch}>Apply changes</Button>
          <Button variant="destructive" onClick={discardPendingAiPatch}>
            Discard changes
          </Button>
        </div>
      ) : (
        applyButton
      )}
    </div>
  );
}
