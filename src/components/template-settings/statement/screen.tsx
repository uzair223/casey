"use client";

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
import { GenerateWithAI, GenerateWithAITrigger } from "../shared/ai-generate";
import { StatementConfigSchema } from "@/lib/schema";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";

export function StatementTemplateSettingsScreen() {
  const {
    userTenantName,
    canForkGlobalTemplate,
    canEditActiveTemplate,
    canPublishTemplate,
    hasPublishedVersion,
    docxErrors,
    templates,
    activeTemplateId,
    activeTemplate,
    currentStatus,
    message,
    draftNameValidationError,
    mainTemplateValidationErrors,
    isLoading,
    editorTab,
    setIsGenerating,
    patchConfig,
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

  if (isLoading) {
    return <Loading />;
  }

  const badges = (template: StatementConfigTemplate) => (
    <>
      <Badge variant={templateStatusVariant[template.status]}>
        {templateStatusLabel[template.status]}
      </Badge>
      <Badge className="capitalize">{template.template_scope}</Badge>
    </>
  );

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={userTenantName ?? "Template settings"}
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
          title="Templates"
          count={templates.length}
          actionLabel="New"
          onAction={() => {
            void createNewTemplate();
          }}
          items={templates}
          activeItemId={activeTemplate?.id}
          getItemId={(template) => template.id}
          onSelectItem={(template) => {
            void selectTemplate(template);
          }}
          renderItem={(template) => (
            <div className="flex w-full flex-col items-start gap-1">
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">{template.name}</span>
                <div className="flex flex-wrap items-center gap-1">
                  {badges(template)}
                </div>
              </div>
            </div>
          )}
          emptyMessage="No templates yet."
        />

        <SidebarContent>
          <Card>
            <CardHeader className="pb-2">
              <GenerateWithAI
                rows={4}
                placeholder="Generate a statement template for a workplace injury claim..."
                resetTrigger={activeTemplateId}
                seedData={draftConfig}
                schema={StatementConfigSchema.omit({
                  case_metadata_deps: true,
                  prompts: true,
                })}
                onRequestSent={() => {
                  setIsGenerating(true);
                }}
                onPartial={({ data }) => {
                  if (!data) return;
                  patchConfig(data);
                }}
                onComplete={({ data }) => {
                  patchConfig(data);
                  setIsGenerating(false);
                }}
                onError={() => {
                  setIsGenerating(false);
                }}
              >
                <div className="fixed bottom-6 left-6">
                  <GenerateWithAITrigger disabled={!canEditActiveTemplate} />
                </div>
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
                        Fork to tenant
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
              {message ? (
                <Card size="md" variant="secondary">
                  <CardHeader>
                    <CardTitle className="text-sm">{message}</CardTitle>
                  </CardHeader>
                </Card>
              ) : null}
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
