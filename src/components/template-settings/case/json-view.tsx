"use client";

import { useEffect, useState } from "react";
import { useCaseTemplateSettings } from "./context";
import { AsyncButton } from "@/components/ui/async-button";
import { Textarea } from "@/components/ui/textarea";

export function CaseTemplateJsonView() {
  const { advancedJson, canEditActiveTemplate, applyAdvancedJson } =
    useCaseTemplateSettings();

  const [draftValue, setDraftValue] = useState(advancedJson);

  useEffect(() => {
    setDraftValue(advancedJson);
  }, [advancedJson]);

  return (
    <div className="space-y-3">
      <Textarea
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        rows={24}
        className="font-mono text-xs"
      />
      <AsyncButton
        onClick={async () => {
          await applyAdvancedJson(draftValue);
        }}
        pendingText="Applying..."
        disabled={!canEditActiveTemplate}
      >
        Apply JSON
      </AsyncButton>
    </div>
  );
}
