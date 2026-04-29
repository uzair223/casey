"use client";

import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/page-title";
import Loading from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarWrapper,
} from "@/components/ui/sidebar";
import {
  templateStatusLabel,
  templateStatusVariant,
} from "@/lib/status-styles";
import type { StatementConfig, StatementConfigTemplate } from "@/types";
import { useStatementTemplateSettings } from "./context";
import { StatementTemplateSimpleView } from "./simple-view";
import { StatementTemplateJsonView } from "./json-view";
import { StatementTemplateDocxView } from "./docx-view";
import { AsyncButton } from "@/components/ui/async-button";
import {
  GenerateWithAI,
  GenerateWithAITrigger,
} from "../../with-ai/template-generate";
import { StatementConfigSchema } from "@/lib/schema";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import {
  Sparkles,
  CalendarArrowDown,
  CalendarArrowUp,
  ArrowDownAZ,
  ArrowDownZA,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectScrollDownButton,
  SelectScrollUpButton,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/user-context";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SelectTrigger, SelectValue } from "@radix-ui/react-select";

const StatementTemplateGenerationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .describe("Short, clear template name shown in the template list."),
    config: StatementConfigSchema.omit({
      schema_version: true,
      case_metadata_deps: true,
      prompts: true,
    }).describe("statement config schema"),
  })
  .strict();

function toTemplateGenerationPatch(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : undefined;
  const config =
    record.config && typeof record.config === "object"
      ? (record.config as Partial<StatementConfig>)
      : undefined;

  if (!name && !config) {
    return null;
  }

  return { name, config };
}

export function StatementTemplateSettingsScreen() {
  const { user } = useUser();
  const [templateSearch, setTemplateSearch] = useState("");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "az" | "za"
  >("newest");

  const {
    canForkGlobalTemplate,
    canEditActiveTemplate,
    canPublishTemplate,
    hasPublishedVersion,
    docxErrors,
    templates,
    activeTemplateId,
    activeTemplate,
    currentStatus,
    draftName,
    draftNameValidationError,
    mainTemplateValidationErrors,
    isLoading,
    editorTab,
    setIsGenerating,
    stageAiTemplatePatch,
    setEditorTab,
    selectTemplate,
    createNewTemplate,
    saveTemplate,
    deleteTemplate,
    duplicateTemplate,
    saveTemplateWithStatus,
    forkTemplate,
    restorePreviousVersion,
  } = useStatementTemplateSettings();
  const { control } = useFormContext<StatementConfig>();
  const { isDirty } = useFormState({ control });
  const draftConfig = (useWatch({ control }) ??
    EMPTY_STATEMENT_CONFIG) as StatementConfig;

  const templateValidationErrors = [
    ...(draftNameValidationError ? [draftNameValidationError] : []),
    ...mainTemplateValidationErrors,
  ];
  const showTemplateValidationIssues =
    isDirty && templateValidationErrors.length > 0;

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    const scopeOrder = { tenant: 0, global: 1 } as const;
    return [...templates]
      .sort((a, b) => {
        const scopeDiff =
          scopeOrder[a.template_scope] - scopeOrder[b.template_scope];
        if (scopeDiff !== 0) {
          return scopeDiff;
        }

        switch (sortOption) {
          case "az":
            return a.name.localeCompare(b.name);
          case "za":
            return b.name.localeCompare(a.name);
          case "oldest":
            return Date.parse(a.updated_at) - Date.parse(b.updated_at);
          case "newest":
          default:
            return Date.parse(b.updated_at) - Date.parse(a.updated_at);
        }
      })
      .filter((template) =>
        query.length === 0 ? true : template.name.toLowerCase().includes(query),
      );
  }, [templates, templateSearch, sortOption]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      // DOCX tab has its own dedicated save handler in docx-view.
      if (editorTab === "docx") {
        return;
      }

      event.preventDefault();

      if (!canEditActiveTemplate) {
        return;
      }

      void saveTemplate();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canEditActiveTemplate, editorTab, saveTemplate]);

  if (isLoading) {
    return <Loading />;
  }

  const badges = (template: StatementConfigTemplate) => (
    <>
      {(user?.role === "tenant_admin"
        ? template.template_scope === "tenant"
        : template.template_scope === "global") && (
        <Badge variant={templateStatusVariant[template.status]}>
          {templateStatusLabel[template.status]}
        </Badge>
      )}
      <Badge className="capitalize">{template.template_scope}</Badge>
    </>
  );

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={user?.tenant_name ?? "Global"}
        title="Statement Templates"
        description="Manage witness intake templates, advanced JSON configuration, and template DOCX files."
        actions={[
          {
            label: "Config Templates",
            href: "/settings/cases",
            variant: "outline",
          },
        ]}
      />

      <SidebarWrapper>
        <Sidebar<StatementConfigTemplate>
          title="Statement Templates"
          actions={[
            <div
              key="statement-template-filters"
              className="w-full flex gap-1.5"
            >
              <Input
                key="statement-template-search"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder="Search templates..."
                className="h-8 flex-1"
              />
              <Select
                key="template-sort"
                value={sortOption}
                onValueChange={(value) =>
                  setSortOption(value as typeof sortOption)
                }
              >
                <SelectTrigger asChild>
                  <Button variant="outline" size="icon-sm">
                    {
                      {
                        az: <ArrowDownAZ />,
                        za: <ArrowDownZA />,
                        newest: <CalendarArrowDown />,
                        oldest: <CalendarArrowUp />,
                      }[sortOption]
                    }
                    <span className="sr-only">
                      <SelectValue />
                    </span>
                  </Button>
                </SelectTrigger>

                <SelectContent>
                  <SelectScrollUpButton />
                  <SelectItem value="az">Alphabetic (asc)</SelectItem>
                  <SelectItem value="za">Alphabetic (desc)</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectScrollDownButton />
                </SelectContent>
              </Select>
            </div>,
            {
              label: "New",
              onClick: () => void createNewTemplate(),
            },
          ]}
          items={filteredTemplates}
          activeItemId={activeTemplate?.id}
          getItemId={(template) => template.id}
          onSelectItem={(template) => {
            void selectTemplate(template);
          }}
          renderItem={(template) => (
            <div className="flex w-full flex-col gap-2">
              <span className="font-medium text-sm">{template.name}</span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {badges(template)}
              </div>
            </div>
          )}
          emptyMessage="No templates yet."
        />

        <SidebarContent>
          <Card>
            <CardHeader className="pb-2">
              <GenerateWithAI
                textareaProps={{
                  placeholder:
                    "Generate a statement template for a workplace injury claim...",
                }}
                resetTrigger={activeTemplateId}
                seedData={{
                  name: draftName || activeTemplate?.name || "",
                  config: draftConfig,
                }}
                schema={StatementTemplateGenerationSchema}
                onRequestSent={() => {
                  setIsGenerating(true);
                }}
                onPartial={({ kind, data }) => {
                  if (kind !== "patch" || !data) return;
                  const patch = toTemplateGenerationPatch(data);
                  if (patch) {
                    stageAiTemplatePatch(patch);
                  }
                }}
                onComplete={({ kind, data }) => {
                  if (kind === "patch" && data) {
                    const patch = toTemplateGenerationPatch(data);
                    if (patch) {
                      stageAiTemplatePatch(patch);
                    }
                  }
                  setIsGenerating(false);
                }}
                onError={() => {
                  setIsGenerating(false);
                }}
              >
                {["simple", "json"].includes(editorTab) && (
                  <div className="fixed bottom-6 right-6">
                    <GenerateWithAITrigger
                      className="rounded-full"
                      disabled={!canEditActiveTemplate}
                    >
                      <Sparkles /> AI Assistant
                    </GenerateWithAITrigger>
                  </div>
                )}
              </GenerateWithAI>

              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Editor</CardTitle>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {activeTemplate && badges(activeTemplate)}
                    {canForkGlobalTemplate ? (
                      <AsyncButton
                        size="sm"
                        variant="outline"
                        onClick={forkTemplate}
                        pendingText="Forking..."
                      >
                        Fork to firm
                      </AsyncButton>
                    ) : null}
                    {canEditActiveTemplate && activeTemplate && (
                      <>
                        {currentStatus !== "draft" && (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={() => saveTemplateWithStatus("draft")}
                            pendingText="Saving..."
                          >
                            Move to draft
                          </AsyncButton>
                        )}
                        {currentStatus !== "published" && (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={() => saveTemplateWithStatus("published")}
                            pendingText="Saving..."
                            disabled={!canPublishTemplate}
                          >
                            Publish
                          </AsyncButton>
                        )}
                        {currentStatus !== "archived" && (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={() => saveTemplateWithStatus("archived")}
                            pendingText="Saving..."
                          >
                            Archive
                          </AsyncButton>
                        )}
                        {activeTemplate ? (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={duplicateTemplate}
                            pendingText="Duplicating..."
                          >
                            Duplicate
                          </AsyncButton>
                        ) : null}
                        {activeTemplate ? (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={deleteTemplate}
                            pendingText="Deleting..."
                          >
                            Delete
                          </AsyncButton>
                        ) : null}
                        {hasPublishedVersion ? (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={restorePreviousVersion}
                            pendingText="Restoring..."
                          >
                            Restore
                          </AsyncButton>
                        ) : null}
                      </>
                    )}

                    {canEditActiveTemplate && (
                      <AsyncButton
                        size="sm"
                        onClick={saveTemplate}
                        pendingText="Saving..."
                      >
                        Save
                      </AsyncButton>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showTemplateValidationIssues ? (
                <Card size="md" variant="destructive">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Validation issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {templateValidationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {docxErrors.errors.length > 0 ? (
                <Card size="md" variant="destructive">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      DOCX validation issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {docxErrors.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              <Tabs
                value={editorTab}
                onValueChange={(value) =>
                  setEditorTab(value as typeof editorTab)
                }
              >
                <TabsList>
                  <TabsTrigger value="simple">Simple</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="docx">DOCX</TabsTrigger>
                </TabsList>
                <TabsContent value="simple" className="pt-4">
                  <StatementTemplateSimpleView />
                </TabsContent>
                <TabsContent value="json" className="pt-4">
                  <StatementTemplateJsonView />
                </TabsContent>
                <TabsContent value="docx" className="pt-4">
                  <StatementTemplateDocxView />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </SidebarContent>
      </SidebarWrapper>
    </section>
  );
}
