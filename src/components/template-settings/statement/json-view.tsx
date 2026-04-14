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
import { useEffect, useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";

export function StatementTemplateJsonView() {
  const {
    advancedJson,
    canEditActiveTemplate,
    applyAdvancedJson,
    draftConfig,
    setDraftConfig,
  } = useStatementTemplateSettings();

  const [draftValue, setDraftValue] = useState(advancedJson);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  useEffect(() => {
    setDraftValue(advancedJson);
  }, [advancedJson]);

  const promptTemplates = draftConfig.prompts ?? getDefaultPromptTemplates();

  const setPromptTemplate = (
    key:
      | "chat_system_template"
      | "metadata_system_template"
      | "formalize_system_template",
    value: string,
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      prompts: {
        ...(prev.prompts ?? getDefaultPromptTemplates()),
        [key]: value,
      },
    }));
  };

  const resetPromptTemplatesToDefault = () => {
    setDraftConfig((prev) => ({
      ...prev,
      prompts: getDefaultPromptTemplates(),
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
      <Textarea
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        rows={24}
        className="font-mono text-xs"
      />
      {!showPromptEditor && applyButton}

      <Card
        size="md"
        variant="warning"
        className="cursor-pointer hover:[--card-opacity:60%]"
        onClick={() => setShowPromptEditor((prev) => !prev)}
      >
        <CardHeader>
          <CardTitle className="text-sm">Advanced Prompt Editor</CardTitle>
          <CardDescription className="text-xs">
            Changes directly affect runtime AI instructions. Use with care.
            Prefer token placeholders over hardcoded structure text so prompts
            stay aligned with template changes.
          </CardDescription>
        </CardHeader>
        {showPromptEditor && (
          <CardContent>
            <CardTitle className="text-sm">Advanced Prompt Editor</CardTitle>
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
            <p className="text-sm font-medium">Chat system prompt template</p>
            <Textarea
              value={promptTemplates.chat_system_template}
              onChange={(event) =>
                setPromptTemplate("chat_system_template", event.target.value)
              }
              disabled={!canEditActiveTemplate}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Metadata system prompt template
            </p>
            <Textarea
              value={promptTemplates.metadata_system_template}
              onChange={(event) =>
                setPromptTemplate(
                  "metadata_system_template",
                  event.target.value,
                )
              }
              disabled={!canEditActiveTemplate}
              rows={12}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Formalize system prompt template
            </p>
            <Textarea
              value={promptTemplates.formalize_system_template}
              onChange={(event) =>
                setPromptTemplate(
                  "formalize_system_template",
                  event.target.value,
                )
              }
              disabled={!canEditActiveTemplate}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          {applyButton}
        </>
      )}
    </div>
  );
}
