"use client";

import { useStatementTemplateSettings } from "./context";
import { Textarea } from "@/components/ui/textarea";
import {
  PROMPT_TEMPLATE_TOKEN_HELP,
  getDefaultPromptTemplates,
} from "@/lib/statement-utils/prompts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";

import { CodeDiffEditor, CodeEditor } from "@/components/ui/code-editor";

export function StatementTemplateJsonView() {
  const {
    advancedJson,
    canEditActiveTemplate,
    applyAdvancedJson,
    draftConfig,
    setDraftConfig,
    pendingAiPatch,
    pendingAiPatchPaths,
    applyPendingAiPatch,
    discardPendingAiPatch,
  } = useStatementTemplateSettings();

  const [draftValue, setDraftValue] = useState(advancedJson);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

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

  const promptTemplates = {
    chat_system_template:
      draftConfig.prompts?.chat_system_template ??
      getDefaultPromptTemplates().chat_system_template,
    formalize_system_template:
      draftConfig.prompts?.formalize_system_template ??
      getDefaultPromptTemplates().formalize_system_template,
  };

  const setPromptTemplate = (
    key: "chat_system_template" | "formalize_system_template",
    value: string,
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      prompts: {
        chat_system_template: prev.prompts?.chat_system_template ?? null,
        formalize_system_template:
          prev.prompts?.formalize_system_template ?? null,
        [key]: value,
      },
    }));
  };

  const resetPromptTemplatesToDefault = () => {
    setDraftConfig((prev) => ({
      ...prev,
      prompts: {
        chat_system_template: null,
        formalize_system_template: null,
      },
    }));
  };

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
        <>
          {!showPromptEditor && applyButton}

          <Card
            size="md"
            variant="warning"
            className="hover:[--card-opacity:60%]"
          >
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowPromptEditor((prev) => !prev)}
            >
              <CardTitle className="text-sm">Advanced Prompt Editor</CardTitle>
              <CardDescription className="text-xs">
                Changes directly affect runtime AI instructions. Use with care.
                Prefer token placeholders over hardcoded structure text so
                prompts stay aligned with template changes.
              </CardDescription>
            </CardHeader>
            {showPromptEditor && (
              <CardContent>
                <CardTitle className="text-sm">
                  Advanced Prompt Editor
                </CardTitle>
                <CardDescription className="space-y-1 text-xs">
                  <ul className="list-disc pl-5">
                    {PROMPT_TEMPLATE_TOKEN_HELP.map(
                      (item: { token: string; description: string }) => (
                        <li key={item.token}>
                          {`{{${item.token}}}`} - {item.description}
                        </li>
                      ),
                    )}
                  </ul>
                </CardDescription>
              </CardContent>
            )}
          </Card>

          {showPromptEditor && (
            <>
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetPromptTemplatesToDefault}
                  disabled={!canEditActiveTemplate}
                >
                  Reset Prompts To Default
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Chat system prompt template
                </p>
                <CodeEditor
                  className="h-48"
                  value={promptTemplates.chat_system_template}
                  onChange={(value) =>
                    canEditActiveTemplate &&
                    setPromptTemplate("chat_system_template", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Formalize system prompt template
                </p>
                <CodeEditor
                  className="h-48"
                  value={promptTemplates.formalize_system_template}
                  onChange={(value) =>
                    canEditActiveTemplate &&
                    setPromptTemplate("formalize_system_template", value)
                  }
                />
              </div>

              {applyButton}
            </>
          )}
        </>
      )}
    </div>
  );
}
