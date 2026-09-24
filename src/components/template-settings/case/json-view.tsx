"use client";

import { useEffect, useState } from "react";
import { useCaseTemplateSettings } from "./context";
import {
  LEAD_TYPE_SECTIONS,
  useTemplateRoute,
} from "../shared/template-route";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";

export function CaseTemplateJsonView() {
  const {
    advancedJson,
    canEditActiveTemplate,
    applyAdvancedJson,
  } = useCaseTemplateSettings();
  const route = useTemplateRoute(LEAD_TYPE_SECTIONS, "basics");

  const [draftValue, setDraftValue] = useState(advancedJson);

  useEffect(() => {
    setDraftValue(advancedJson);
  }, [advancedJson]);

  return (
    <div className="space-y-3">
      <CodeEditor
        mode="json"
        className="h-[65vh]"
        value={draftValue}
        onChange={(val) => setDraftValue(val)}
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
      <Button
        type="button"
        variant="outline"
        onClick={() => route.setView("simple")}
      >
        Simple editor
      </Button>
    </div>
  );
}
