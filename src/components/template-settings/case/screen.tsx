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
import type { CaseTemplate } from "@/types";
import { useCaseTemplateSettings } from "./context";
import { CaseTemplateSimpleView } from "./simple-view";
import { CaseTemplateJsonView } from "./json-view";
import { AsyncButton } from "@/components/ui/async-button";
import {
  templateStatusLabel,
  templateStatusVariant,
} from "@/lib/status-styles";
import { Input } from "@/components/ui/input";

export function CaseTemplateSettingsScreen() {
  const [templateSearch, setTemplateSearch] = useState("");

  const {
    userTenantName,
    canForkGlobalTemplate,
    canEditActiveTemplate,
    isTenantAdmin,
    isLoading,
    message,
    caseTemplates,
    activeTemplate,
    defaultTemplateId,
    favouriteTemplateIds,
    editorTab,
    currentStatus,
    selectTemplate,
    createNewTemplate,
    deleteTemplate,
    duplicateTemplate,
    saveTemplateWithStatus,
    saveTemplate,
    forkTemplate,
    toggleFavourite,
    toggleDefault,
    setEditorTab,
  } = useCaseTemplateSettings();

  const filteredCaseTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();

    return [...caseTemplates]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .filter((template) =>
        query.length === 0 ? true : template.name.toLowerCase().includes(query),
      );
  }, [caseTemplates, templateSearch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
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
  }, [canEditActiveTemplate, saveTemplate]);

  if (isLoading) {
    return <Loading />;
  }

  const badges = (template: CaseTemplate) => (
    <>
      <Badge variant={templateStatusVariant[template.status]}>
        {templateStatusLabel[template.status]}
      </Badge>
      <Badge className="capitalize">{template.template_scope}</Badge>
      {template.id === defaultTemplateId ? <Badge>Default</Badge> : null}
      {template.id !== defaultTemplateId &&
      favouriteTemplateIds.includes(template.id) ? (
        <Badge>Favourite</Badge>
      ) : null}
    </>
  );

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={userTenantName ?? "Case template settings"}
        title="Case Templates"
        description="Manage case templates, mapping to statement templates, and JSON configuration."
        actions={[
          {
            label: "Statement Templates",
            href: "/settings/statements",
            variant: "outline",
          },
        ]}
      />

      <SidebarWrapper>
        <Sidebar<CaseTemplate>
          title="Case Templates"
          actions={[
            <Input
              key="case-template-search"
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Search templates..."
              className="h-8"
            />,
            {
              label: "New",
              onClick: () => void createNewTemplate(),
            },
          ]}
          items={filteredCaseTemplates}
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
          emptyMessage="No case templates yet."
        />

        <SidebarContent>
          <Card>
            <CardHeader className="pb-2">
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
                    {isTenantAdmin && activeTemplate ? (
                      <>
                        <AsyncButton
                          variant="outline"
                          size="sm"
                          onClick={toggleFavourite}
                          pendingText="Saving..."
                        >
                          {favouriteTemplateIds.includes(activeTemplate.id)
                            ? "Unfavourite"
                            : "Favourite"}
                        </AsyncButton>

                        <AsyncButton
                          variant="outline"
                          size="sm"
                          onClick={toggleDefault}
                          pendingText="Pinning..."
                        >
                          {activeTemplate.id === defaultTemplateId
                            ? "Unpin"
                            : "Pin as default"}
                        </AsyncButton>
                      </>
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
                        {activeTemplate?.id ? (
                          <AsyncButton
                            variant="outline"
                            size="sm"
                            onClick={duplicateTemplate}
                            pendingText="Duplicating..."
                          >
                            Duplicate
                          </AsyncButton>
                        ) : null}
                        {activeTemplate?.id ? (
                          <AsyncButton
                            variant="outline"
                            size="sm"
                            onClick={deleteTemplate}
                            pendingText="Deleting..."
                          >
                            Delete
                          </AsyncButton>
                        ) : null}
                        <AsyncButton
                          size="sm"
                          onClick={saveTemplate}
                          pendingText="Saving..."
                        >
                          Save
                        </AsyncButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={editorTab}
                onValueChange={(value) =>
                  setEditorTab(value as typeof editorTab)
                }
              >
                <TabsList>
                  <TabsTrigger value="simple">Simple</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
                <TabsContent value="simple" className="pt-4">
                  <CaseTemplateSimpleView />
                </TabsContent>
                <TabsContent value="json" className="pt-4">
                  <CaseTemplateJsonView />
                </TabsContent>
              </Tabs>

              {message ? (
                <p className="text-sm text-muted-foreground">{message}</p>
              ) : null}
            </CardContent>
          </Card>
        </SidebarContent>
      </SidebarWrapper>
    </section>
  );
}
